#!/usr/bin/env python3
"""
Script para procesar correos de transferencia SPEI que ya están marcados como leídos
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from src.email_client import EmailClient
from src.transfer_processor import TransferProcessor
from src.supabase_client import SupabaseClient
from src.logger import logger
import email

def procesar_transferencias_leidas():
    """Procesa correos de transferencia SPEI aunque estén leídos"""
    
    logger.info("=== PROCESANDO TRANSFERENCIAS SPEI (INCLUYENDO LEÍDOS) ===")
    
    # Inicializar componentes
    email_client = EmailClient()
    transfer_processor = TransferProcessor()
    supabase_client = SupabaseClient()
    
    try:
        # Conectar
        if not email_client.connect():
            logger.error("No se pudo conectar al servidor de correo")
            return
        
        # Seleccionar bandeja de entrada
        if not email_client.select_inbox():
            logger.error("No se pudo seleccionar la bandeja de entrada")
            return
        
        # Buscar TODOS los correos (no solo no leídos)
        logger.info("Buscando correos en la bandeja de entrada...")
        status, email_ids = email_client.imap_server.search(None, 'ALL')
        
        if status != 'OK':
            logger.error("Error al buscar correos")
            return
        
        email_id_list = email_ids[0].split()
        logger.info(f"Se encontraron {len(email_id_list)} correos en total")
        
        # Invertir para procesar los más recientes primero
        email_id_list.reverse()
        
        transfer_procesadas = 0
        transfer_insertadas = 0
        transfer_duplicadas = 0
        transfer_errores = 0
        
        for email_id in email_id_list:
            try:
                # Obtener el correo sin marcar como leído (usando PEEK)
                status, msg_data = email_client.imap_server.fetch(email_id, '(BODY.PEEK[HEADER])')
                
                if status != 'OK':
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                subject = msg.get('subject', 'Sin asunto')
                
                # Verificar si es transferencia SPEI
                if transfer_processor.is_transfer_email(subject):
                    logger.info(f"📧 Procesando transferencia SPEI: {subject}")
                    transfer_procesadas += 1
                    
                    # Obtener el correo completo
                    status, msg_data = email_client.imap_server.fetch(email_id, '(BODY.PEEK[])')
                    if status == 'OK':
                        raw_email = msg_data[0][1]
                        msg = email.message_from_bytes(raw_email)
                        
                        # Procesar el correo
                        transfer_result = transfer_processor.process_transfer_email(msg)
                        
                        if transfer_result['processed'] and transfer_result['data']:
                            # Insertar en Supabase
                            if supabase_client.insert_movimiento_bancario(transfer_result['data']):
                                transfer_insertadas += 1
                                logger.info(f"✅ Transferencia SPEI insertada: {transfer_result['data'].get('rastreo')}")
                                
                                # Marcar como leído (por si acaso)
                                email_client.mark_email_as_read(email_id)
                                
                                # Mover a carpeta BanBajio
                                email_client.move_email_to_folder(email_id, 'BanBajio')
                            else:
                                # Verificar si es duplicado
                                if transfer_result['data'].get('rastreo'):
                                    existing = supabase_client.get_movimiento_by_rastreo(transfer_result['data']['rastreo'])
                                    if existing:
                                        transfer_duplicadas += 1
                                        logger.warning(f"⚠️ Transferencia SPEI duplicada: {transfer_result['data']['rastreo']}")
                                    else:
                                        transfer_errores += 1
                                        logger.error(f"❌ Error al insertar transferencia SPEI: {transfer_result['data'].get('rastreo')}")
                        else:
                            transfer_errores += 1
                            logger.error(f"❌ Error al procesar transferencia SPEI: {transfer_result.get('message', 'Error desconocido')}")
                    
            except Exception as e:
                logger.error(f"Error al procesar correo {email_id}: {e}")
                continue
        
        logger.info(f"\n=== RESUMEN ===")
        logger.info(f"Transferencias SPEI encontradas: {transfer_procesadas}")
        logger.info(f"Transferencias SPEI insertadas: {transfer_insertadas}")
        logger.info(f"Transferencias SPEI duplicadas: {transfer_duplicadas}")
        logger.info(f"Errores: {transfer_errores}")
        
    except Exception as e:
        logger.error(f"Error en el procesamiento: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        email_client.disconnect()

if __name__ == "__main__":
    procesar_transferencias_leidas()

