"""
Módulo principal de procesamiento de facturas

Flujo de Organización de Correos:
==================================

1. Correos con XML (Facturas):
   - Se procesan los XML y se guardan en la base de datos
   - Se marcan como leídos y se mueven a carpeta 'procesados'

2. Correos de Depósito (ya implementado):
   - Se extraen datos del depósito y se guardan en Supabase
   - Se marcan como leídos y se mueven a carpeta 'BanBajio'

3. Correos Bancarios (generales):
   - Se identifican pero no se procesan completamente
   - NO se marcan como leídos (permanecen en inbox para revisión manual)

4. Correos "otros" (no coinciden con tipos anteriores):
   - Se mueven a carpeta 'BanBajio/otros' sin marcar como leídos
   - Evitan saturar la bandeja de entrada principal

Para AGREGAR NUEVOS TIPOS DE CORREOS:
====================================

1. Crear un nuevo processor (ej: src/nuevo_tipo_processor.py)
2. Importarlo en este archivo y añadirlo a __init__
3. Añadirlo a la lista processed_email_types en _process_single_email():
   processed_email_types = [
       self.deposit_processor.is_deposit_email(subject),  # Depósitos
       self.nuevo_processor.is_nuevo_email(subject),     # Nuevo tipo
       # Más tipos...
   ]
4. Antes del bloque "Si no tiene XML...", añadir el procesamiento:
   if self.nuevo_processor.is_nuevo_email(subject):
       # Procesar correo del nuevo tipo
       nuevo_result = self.nuevo_processor.process_nuevo_email(msg)
       # ...lógica de procesamiento...
       # Si se procesa correctamente, marcar como leído y mover a 'BanBajio'
       return stats

Este diseño permite agregar tipos de correos procesables sin modificar la lógica existente.
"""

import time
from datetime import datetime
from typing import List, Tuple
from email.message import Message
from .config import Config
from .logger import logger
from .email_client import EmailClient
from .xml_parser import XMLParser
from .factura_mapper import FacturaMapper
from .supabase_client import SupabaseClient
from .bank_processor import BankProcessor
from .deposit_processor import DepositProcessor
from .transfer_processor import TransferProcessor

class FacturaProcessor:
    """Clase principal para procesamiento de facturas, depósitos y correos bancarios desde correo"""

    def __init__(self):
        """Inicializa el procesador de facturas"""
        self.email_client = EmailClient()
        self.xml_parser = XMLParser()
        self.factura_mapper = FacturaMapper()
        self.supabase_client = SupabaseClient()
        self.bank_processor = BankProcessor()
        self.deposit_processor = DepositProcessor()
        self.transfer_processor = TransferProcessor()
        self.running = False

        logger.info("Procesador de facturas, depósitos, transferencias SPEI y correos bancarios inicializado")
    
    def start_processing(self):
        """Inicia el procesamiento continuo de correos"""
        logger.info("Iniciando procesamiento continuo de facturas")
        self.running = True

        # Mostrar configuración de horarios
        schedule_info = Config.get_schedule_info()
        if schedule_info['enabled']:
            logger.info(f"⏰ Horario configurado: {schedule_info['start_time']} - {schedule_info['end_time']}")
            logger.info(f"📅 Días permitidos: {', '.join(schedule_info['days'])}")
        else:
            logger.info("⏰ Sin restricción de horario (funcionamiento 24/7)")

        try:
            # Validar configuración
            Config.validate_config()

            # Crear carpetas si no existen
            if not self.email_client.create_folder_if_not_exists('procesados'):
                logger.warning("No se pudo crear la carpeta 'procesados', los correos permanecerán en INBOX")
            if not self.email_client.create_folder_if_not_exists('BanBajio'):
                logger.warning("No se pudo crear la carpeta 'BanBajio', los correos de depósito permanecerán en INBOX")
            if not self.email_client.create_folder_if_not_exists('BanBajio/otros'):
                logger.warning("No se pudo crear la carpeta 'BanBajio/otros', los correos 'otros' permanecerán en INBOX")
            else:
                logger.info("Carpeta 'BanBajio/otros' disponible para correos no procesados")

            # Probar conexiones
            if not self._test_connections():
                logger.error("Error en las conexiones iniciales. Deteniendo procesador.")
                return

            # Bucle principal de procesamiento
            last_activity_count = 0  # Contador de correos procesados
            idle_cycles = 0  # Contador de ciclos sin actividad

            while self.running:
                try:
                    # Verificar si está dentro del horario permitido
                    if not Config.is_schedule_active():
                        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        logger.info(f"⏸️  Fuera de horario ({current_time}). El sistema está en pausa.")

                        # Esperar hasta el siguiente ciclo (usar intervalo idle)
                        sleep_time = Config.POLLING_INTERVAL_IDLE
                        logger.debug(f"Esperando {sleep_time} segundos para verificar horario nuevamente")
                        time.sleep(sleep_time)
                        continue

                    # Procesar correos
                    stats = self._process_emails()

                    # Determinar intervalo según actividad
                    current_activity = (stats.get('emails_processed', 0) +
                                       stats.get('facturas_processed', 0) +
                                       stats.get('transfer_inserted', 0) +
                                       stats.get('deposit_inserted', 0))

                    if current_activity > 0:
                        # Hubo actividad, usar intervalo normal
                        interval = Config.POLLING_INTERVAL
                        last_activity_count = current_activity
                        idle_cycles = 0
                        logger.debug(f"Actividad detectada ({current_activity} procesados). Próximo ciclo en {interval}s")
                    else:
                        # Sin actividad, incrementar contador y usar intervalo más largo
                        idle_cycles += 1
                        if idle_cycles >= 3:  # Después de 3 ciclos sin actividad
                            interval = Config.POLLING_INTERVAL_IDLE
                            logger.debug(f"Sin actividad por {idle_cycles} ciclos. Usando intervalo extendido de {interval}s")
                        else:
                            interval = Config.POLLING_INTERVAL
                            logger.debug(f"Sin actividad ({idle_cycles} ciclos). Próximo ciclo en {interval}s")

                    # Esperar antes del siguiente ciclo
                    time.sleep(interval)

                except KeyboardInterrupt:
                    logger.info("Interrupción del usuario detectada. Deteniendo procesador.")
                    break
                except Exception as e:
                    logger.error(f"Error en el ciclo de procesamiento: {str(e)}")
                    time.sleep(30)  # Esperar 30 segundos antes de reintentar

        except Exception as e:
            logger.critical(f"Error crítico en el procesador: {str(e)}")
        finally:
            self._cleanup()
            logger.info("Procesador de facturas detenido")
    
    def stop_processing(self):
        """Detiene el procesamiento"""
        logger.info("Deteniendo procesamiento de facturas")
        self.running = False
    
    def process_once(self) -> dict:
        """
        Procesa los correos una sola vez (para pruebas o ejecución manual)

        Returns:
            dict: Estadísticas del procesamiento
        """
        logger.info("Iniciando procesamiento único de correos")

        stats = {
            'emails_processed': 0,
            'xml_files_found': 0,
            'facturas_processed': 0,
            'facturas_inserted': 0,
            'duplicates_found': 0,
            'bank_emails_found': 0,
            'bank_emails_processed': 0,
            'deposit_emails_found': 0,
            'deposit_emails_processed': 0,
            'deposit_inserted': 0,
            'deposit_duplicates': 0,
            'transfer_emails_found': 0,
            'transfer_emails_processed': 0,
            'transfer_inserted': 0,
            'transfer_duplicates': 0,
            'errors': 0
        }

        try:
            # Validar configuración
            Config.validate_config()

            # Crear carpetas si no existen
            if not self.email_client.create_folder_if_not_exists('procesados'):
                logger.warning("No se pudo crear la carpeta 'procesados', los correos permanecerán en INBOX")
            if not self.email_client.create_folder_if_not_exists('BanBajio'):
                logger.warning("No se pudo crear la carpeta 'BanBajio', los correos de depósito permanecerán en INBOX")
            if not self.email_client.create_folder_if_not_exists('BanBajio/otros'):
                logger.warning("No se pudo crear la carpeta 'BanBajio/otros', los correos 'otros' permanecerán en INBOX")
            else:
                logger.info("Carpeta 'BanBajio/otros' disponible para correos no procesados")

            # Procesar correos
            stats = self._process_emails()

        except Exception as e:
            logger.error(f"Error en procesamiento único: {str(e)}")
            stats['errors'] += 1

        logger.info(f"Procesamiento único finalizado: {stats}")
        return stats
    
    def _test_connections(self) -> bool:
        """
        Prueba las conexiones con los servicios
        
        Returns:
            bool: True si todas las conexiones son exitosas
        """
        try:
            # Probar conexión con Supabase
            if not self.supabase_client.test_connection():
                logger.error("Error en la conexión con Supabase")
                return False
            
            # Probar conexión con correo
            if not self.email_client.test_connection():
                logger.error("Error en la conexión con el servidor de correo")
                return False
            
            logger.info("Todas las conexiones fueron exitosas")
            return True
            
        except Exception as e:
            logger.error(f"Error al probar conexiones: {str(e)}")
            return False
    
    def _process_emails(self) -> dict:
        """
        Procesa los correos no leídos
        
        Returns:
            dict: Estadísticas del procesamiento
        """
        stats = {
            'emails_processed': 0,
            'xml_files_found': 0,
            'facturas_processed': 0,
            'facturas_inserted': 0,
            'duplicates_found': 0,
            'bank_emails_found': 0,
            'bank_emails_processed': 0,
            'deposit_emails_found': 0,
            'deposit_emails_processed': 0,
            'deposit_inserted': 0,
            'deposit_duplicates': 0,
            'transfer_emails_found': 0,
            'transfer_emails_processed': 0,
            'transfer_inserted': 0,
            'transfer_duplicates': 0,
            'errors': 0
        }
        
        try:
            # Obtener correos no leídos
            unread_emails = self.email_client.get_unread_emails()
            stats['emails_processed'] = len(unread_emails)
            
            if not unread_emails:
                logger.info("No hay correos no leídos para procesar")
                return stats
            
            logger.info(f"Procesando {len(unread_emails)} correos no leídos")
            
            for email_id, msg in unread_emails:
                try:
                    # Procesar cada correo
                    email_stats = self._process_single_email(email_id, msg)
                    
                    # Acumular estadísticas
                    stats['xml_files_found'] += email_stats['xml_files_found']
                    stats['facturas_processed'] += email_stats['facturas_processed']
                    stats['facturas_inserted'] += email_stats['facturas_inserted']
                    stats['duplicates_found'] += email_stats.get('duplicates_found', 0)
                    stats['bank_emails_found'] += email_stats.get('bank_emails_found', 0)
                    stats['bank_emails_processed'] += email_stats.get('bank_emails_processed', 0)
                    stats['deposit_emails_found'] += email_stats.get('deposit_emails_found', 0)
                    stats['deposit_emails_processed'] += email_stats.get('deposit_emails_processed', 0)
                    stats['deposit_inserted'] += email_stats.get('deposit_inserted', 0)
                    stats['deposit_duplicates'] += email_stats.get('deposit_duplicates', 0)
                    stats['transfer_emails_found'] += email_stats.get('transfer_emails_found', 0)
                    stats['transfer_emails_processed'] += email_stats.get('transfer_emails_processed', 0)
                    stats['transfer_inserted'] += email_stats.get('transfer_inserted', 0)
                    stats['transfer_duplicates'] += email_stats.get('transfer_duplicates', 0)
                    stats['errors'] += email_stats['errors']
                    
                except Exception as e:
                    logger.error(f"Error al procesar correo {email_id}: {str(e)}")
                    stats['errors'] += 1
                    continue
            
            logger.info(f"📊 ESTADÍSTICAS FINALES:")
            logger.info(f"   - Correos totales procesados: {stats['emails_processed']}")
            logger.info(f"   - Transferencias SPEI encontradas: {stats['transfer_emails_found']}")
            logger.info(f"   - Transferencias SPEI procesadas: {stats['transfer_emails_processed']}")
            logger.info(f"   - Transferencias SPEI insertadas: {stats['transfer_inserted']}")
            logger.info(f"   - Depósitos encontrados: {stats['deposit_emails_found']}")
            logger.info(f"   - Depósitos procesados: {stats['deposit_emails_processed']}")
            logger.info(f"   - Depósitos insertados: {stats['deposit_inserted']}")
            logger.info(f"   - Correos bancarios: {stats['bank_emails_found']}")
            logger.info(f"   - Correos 'otros' movidos: {stats.get('otros_moved', 0)}")
            logger.info(f"   - Archivos XML encontrados: {stats['xml_files_found']}")
            logger.info(f"   - Facturas procesadas: {stats['facturas_processed']}")
            logger.info(f"   - Facturas insertadas: {stats['facturas_inserted']}")
            logger.info(f"   - Errores: {stats['errors']}")
            logger.info(f"Procesamiento finalizado: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Error al procesar correos: {str(e)}")
            stats['errors'] += 1
            return stats
    
    def _process_single_email(self, email_id: bytes, msg: Message) -> dict:
        """
        Procesa un solo correo electrónico

        Args:
            email_id: ID del correo
            msg: Mensaje de correo

        Returns:
            dict: Estadísticas del procesamiento del correo
        """
        stats = {
            'xml_files_found': 0,
            'facturas_processed': 0,
            'facturas_inserted': 0,
            'duplicates_found': 0,
            'bank_emails_found': 0,
            'bank_emails_processed': 0,
            'deposit_emails_found': 0,
            'deposit_emails_processed': 0,
            'deposit_inserted': 0,
            'deposit_duplicates': 0,
            'transfer_emails_found': 0,
            'transfer_emails_processed': 0,
            'transfer_inserted': 0,
            'transfer_duplicates': 0,
            'errors': 0
        }

        try:
            # Obtener información del correo
            email_info = self.email_client.get_email_info(msg)
            subject = email_info['subject']
            from_addr = email_info['from']
            is_bank = email_info['is_bank']

            logger.info(f"🔍 ANALIZANDO CORREO: {subject} de {from_addr}")

            # Verificar si es un correo de transferencia SPEI (ANTES de depósitos)
            # Usar el subject directamente del mensaje para mejor detección
            raw_subject = msg.get('subject', '')
            if self.transfer_processor.is_transfer_email(raw_subject):
                stats['transfer_emails_found'] = 1
                logger.info(f"Correo de transferencia SPEI identificado: {subject}")

                # Procesar correo de transferencia
                logger.info(f"Llamando a process_transfer_email() para: {subject}")
                transfer_result = self.transfer_processor.process_transfer_email(msg)
                logger.info(f"Resultado de process_transfer_email(): {transfer_result}")

                if transfer_result['processed'] and transfer_result['data']:
                    stats['transfer_emails_processed'] = 1

                    # Insertar en Supabase
                    if self.supabase_client.insert_movimiento_bancario(transfer_result['data']):
                        stats['transfer_inserted'] = 1
                        logger.info(f"Transferencia SPEI insertada correctamente: {transfer_result['data'].get('rastreo')}")

                        # Marcar como leído
                        if self.email_client.mark_email_as_read(email_id):
                            logger.info(f"✅ Correo TRANSFERENCIA SPEI marcado como leído: {subject}")

                            # Mover a carpeta BanBajio
                            logger.info(f"ACCION: Moviendo correo TRANSFERENCIA SPEI a carpeta 'BanBajio'")
                            if self.email_client.move_email_to_folder(email_id, 'BanBajio'):
                                logger.info(f"✅ EXITO: Correo TRANSFERENCIA SPEI movido a 'BanBajio': {subject}")
                            else:
                                logger.warning(f"❌ ERROR: No se pudo mover correo TRANSFERENCIA SPEI a 'BanBajio': {subject}")
                    else:
                        # Verificar si es un duplicado (no contar como error, pero SÍ marcar como leído)
                        if transfer_result['data'].get('rastreo'):
                            existing = self.supabase_client.get_movimiento_by_rastreo(transfer_result['data']['rastreo'])
                            if existing:
                                stats['transfer_duplicates'] += 1
                                logger.warning(f"Transferencia SPEI duplicada (ya existe): {transfer_result['data']['rastreo']}")

                                # IMPORTANTE: Marcar como leído y mover para evitar ciclo infinito
                                if self.email_client.mark_email_as_read(email_id):
                                    logger.info(f"✅ Correo TRANSFERENCIA SPEI duplicado marcado como leído: {subject}")

                                    # Mover a carpeta BanBajio
                                    logger.info(f"ACCION: Moviendo correo TRANSFERENCIA SPEI duplicado a carpeta 'BanBajio'")
                                    if self.email_client.move_email_to_folder(email_id, 'BanBajio'):
                                        logger.info(f"✅ EXITO: Correo TRANSFERENCIA SPEI duplicado movido a 'BanBajio': {subject}")
                                    else:
                                        logger.warning(f"❌ ERROR: No se pudo mover correo TRANSFERENCIA SPEI duplicado a 'BanBajio': {subject}")
                                else:
                                    logger.warning(f"❌ ERROR: No se pudo marcar correo duplicado como leído: {subject}")
                                    stats['errors'] += 1
                            else:
                                logger.error(f"Error al insertar transferencia SPEI: {transfer_result['data'].get('rastreo')}")
                                stats['errors'] += 1
                else:
                    stats['errors'] += transfer_result['errors']
                    logger.error(f"Error al procesar correo de transferencia SPEI: {subject}")

                return stats

            # Verificar si es un correo de depósito
            # Usar el subject directamente del mensaje para mejor detección
            if self.deposit_processor.is_deposit_email(raw_subject):
                stats['deposit_emails_found'] = 1
                logger.info(f"Correo de depósito identificado: {subject}")

                # Procesar correo de depósito
                logger.info(f"Llamando a process_deposit_email() para: {subject}")
                deposit_result = self.deposit_processor.process_deposit_email(msg)
                logger.info(f"Resultado de process_deposit_email(): {deposit_result}")

                if deposit_result['processed'] and deposit_result['data']:
                    stats['deposit_emails_processed'] = 1

                    # Insertar en Supabase
                    if self.supabase_client.insert_movimiento_bancario(deposit_result['data']):
                        stats['deposit_inserted'] = 1
                        logger.info(f"Depósito insertado correctamente: {deposit_result['data'].get('rastreo')}")

                        # Marcar como leído
                        if self.email_client.mark_email_as_read(email_id):
                            logger.info(f"✅ Correo DEPÓSITO marcado como leído: {subject}")

                            # Mover a carpeta BanBajio
                            logger.info(f"ACCION: Moviendo correo DEPÓSITO a carpeta 'BanBajio'")
                            if self.email_client.move_email_to_folder(email_id, 'BanBajio'):
                                logger.info(f"✅ EXITO: Correo DEPÓSITO movido a 'BanBajio': {subject}")
                            else:
                                logger.warning(f"❌ ERROR: No se pudo mover correo DEPÓSITO a 'BanBajio': {subject}")
                    else:
                        # Verificar si es un duplicado (no contar como error, pero SÍ marcar como leído)
                        if deposit_result['data'].get('rastreo'):
                            existing = self.supabase_client.get_movimiento_by_rastreo(deposit_result['data']['rastreo'])
                            if existing:
                                stats['deposit_duplicates'] += 1
                                logger.warning(f"Depósito duplicado (ya existe): {deposit_result['data']['rastreo']}")

                                # IMPORTANTE: Marcar como leído y mover para evitar ciclo infinito
                                if self.email_client.mark_email_as_read(email_id):
                                    logger.info(f"✅ Correo DEPÓSITO duplicado marcado como leído: {subject}")

                                    # Mover a carpeta BanBajio
                                    logger.info(f"ACCION: Moviendo correo DEPÓSITO duplicado a carpeta 'BanBajio'")
                                    if self.email_client.move_email_to_folder(email_id, 'BanBajio'):
                                        logger.info(f"✅ EXITO: Correo DEPÓSITO duplicado movido a 'BanBajio': {subject}")
                                    else:
                                        logger.warning(f"❌ ERROR: No se pudo mover correo DEPÓSITO duplicado a 'BanBajio': {subject}")
                                else:
                                    logger.warning(f"❌ ERROR: No se pudo marcar correo duplicado como leído: {subject}")
                                    stats['errors'] += 1
                            else:
                                logger.error(f"Error al insertar depósito: {deposit_result['data'].get('rastreo')}")
                                stats['errors'] += 1
                else:
                    stats['errors'] += deposit_result['errors']
                    logger.error(f"Error al procesar correo de depósito: {subject}")

                return stats

            # Extraer archivos XML adjuntos
            xml_files = self.email_client.get_xml_attachments(msg)
            stats['xml_files_found'] = len(xml_files)

            # Determinar el tipo de correo y cómo procesarlo
            email_processed = False

            # Tipos de correos que se procesan y van a carpeta BanBajio
            processed_email_types = [
                self.transfer_processor.is_transfer_email(subject),  # Correos de transferencia SPEI
                self.deposit_processor.is_deposit_email(subject),  # Correos de depósito
                # Aquí se agregarán futuros tipos de correos a procesar
                # ej: self.other_processor.is_other_email(subject)
            ]

            # Si es un correo bancario regular (no es depósito), procesarlo diferente
            if is_bank and not processed_email_types[0]:
                stats['bank_emails_found'] = 1
                logger.info(f"Correo bancario identificado: {subject}")

                # Procesar correo bancario (sin marcar como leído)
                bank_result = self.bank_processor.process_bank_email(msg)

                if bank_result['processed']:
                    stats['bank_emails_processed'] = 1
                    logger.info(f"Correo bancario procesado: {subject}")
                else:
                    stats['errors'] += bank_result['errors']
                    logger.error(f"Error al procesar correo bancario: {subject}")

                # IMPORTANTE: No marcar correos bancarios como leídos, pero SÍ moverlos a otros
                logger.info(f"ACCION: Moviendo correo BANCARIO a carpeta 'BanBajio/otros' (sin marcar como leído)")
                if self.email_client.move_email_to_folder(email_id, 'BanBajio/otros'):
                    logger.info(f"✅ EXITO: Correo BANCARIO movido a 'BanBajio/otros': {subject}")
                    stats['otros_moved'] = 1
                else:
                    logger.warning(f"❌ ERROR: No se pudo mover correo BANCARIO a 'BanBajio/otros': {subject}")
                    stats['errors'] += 1

                return stats

            # Si no tiene XML y no es un tipo de correo procesado
            if not xml_files and not any(processed_email_types):
                logger.info(f"Correo identificado como 'OTROS' - no contiene XML ni es tipo procesado: {subject}")
                logger.info(f"De: {from_addr} | Subject: {subject}")

                # Mover a carpeta BanBajio/otros sin marcar como leído
                logger.info(f"ACCION: Moviendo correo 'OTROS' a carpeta 'BanBajio/otros' (sin marcar como leído)")
                if self.email_client.move_email_to_folder(email_id, 'BanBajio/otros'):
                    logger.info(f"✅ EXITO: Correo 'OTROS' movido a 'BanBajio/otros': {subject}")
                    stats['otros_moved'] = stats.get('otros_moved', 0) + 1
                else:
                    logger.warning(f"❌ ERROR: No se pudo mover correo 'OTROS' a 'BanBajio/otros': {subject}")
                    # Si no se puede mover, marcar como leído para evitar reprocesar
                    logger.info(f"FALLBACK: Marcando correo 'OTROS' como leído para evitar reprocesar")
                    self.email_client.mark_email_as_read(email_id)

                return stats

            # Procesar cada archivo XML
            for xml_content in xml_files:
                try:
                    # Parsear XML
                    xml_data = self.xml_parser.parse_xml(xml_content)
                    if not xml_data:
                        logger.error("Error al parsear XML")
                        stats['errors'] += 1
                        continue

                    stats['facturas_processed'] += 1

                    # Mapear a estructura de catFacturas
                    factura_data = self.factura_mapper.map_to_catfacturas(xml_data)
                    if not factura_data:
                        logger.error("Error al mapear factura")
                        stats['errors'] += 1
                        continue

                    # Insertar en Supabase
                    if self.supabase_client.insert_factura(factura_data):
                        stats['facturas_inserted'] += 1
                        logger.info(f"Factura insertada correctamente: {factura_data.get('uuidCFDI')}")
                    else:
                        # Verificar si es un duplicado (no contar como error para marcar correo)
                        existing = self.supabase_client.get_factura_by_uuid(factura_data.get('uuidCFDI'))
                        if existing:
                            stats['duplicates_found'] += 1
                            logger.warning(f"Factura duplicada (ya existe): {factura_data.get('uuidCFDI')}")
                        else:
                            logger.error(f"Error al insertar factura: {factura_data.get('uuidCFDI')}")
                            stats['errors'] += 1

                except Exception as e:
                    logger.error(f"Error al procesar archivo XML: {str(e)}")
                    stats['errors'] += 1
                    continue

            # Marcar correo como leído y mover a procesados si:
            # - No hubo errores, O
            # - Solo hubo duplicados (los duplicados no son errores críticos)
            if stats['errors'] == 0:
                # Marcar como leído
                if self.email_client.mark_email_as_read(email_id):
                    if stats['duplicates_found'] > 0:
                        logger.info(f"✅ Correo FACTURA marcado como leído ({stats['duplicates_found']} duplicados): {subject}")
                    else:
                        logger.info(f"✅ Correo FACTURA marcado como leído: {subject}")

                    # Mover a carpeta procesados (solo para correos no bancarios)
                    logger.info(f"ACCION: Moviendo correo FACTURA XML a carpeta 'procesados'")
                    if self.email_client.move_email_to_folder(email_id, 'procesados'):
                        logger.info(f"✅ EXITO: Correo FACTURA XML movido a 'procesados': {subject}")
                    else:
                        logger.error(f"❌ ERROR: No se pudo mover correo FACTURA XML a 'procesados': {subject}")
                else:
                    logger.warning(f"No se pudo marcar como leído: {subject}")
            else:
                logger.warning(f"Correo NO marcado como leído debido a {stats['errors']} errores: {subject}")
            
            return stats
            
        except Exception as e:
            logger.error(f"Error al procesar correo individual: {str(e)}")
            stats['errors'] += 1
            return stats
    
    def _cleanup(self):
        """Realiza limpieza de recursos"""
        try:
            # Cerrar conexión de correo
            self.email_client.disconnect()
            logger.info("Limpieza de recursos completada")
        except Exception as e:
            logger.error(f"Error en limpieza: {str(e)}")
    
    def get_status(self) -> dict:
        """
        Obtiene el estado actual del procesador
        
        Returns:
            dict: Estado del procesador
        """
        try:
            # Obtener estadísticas de Supabase
            facturas_count = self.supabase_client.get_facturas_count()
            
            status = {
                'running': self.running,
                'facturas_en_db': facturas_count,
                'config': {
                    'imap_server': Config.IMAP_SERVER,
                    'imap_port': Config.IMAP_PORT,
                    'imap_user': Config.IMAP_USER,
                    'supabase_url': Config.SUPABASE_URL,
                    'polling_interval': Config.POLLING_INTERVAL,
                    'log_level': Config.LOG_LEVEL
                }
            }
            
            return status
            
        except Exception as e:
            logger.error(f"Error al obtener estado: {str(e)}")
            return {
                'running': self.running,
                'error': str(e)
            }