"""
Módulo para procesamiento de correos de Transferencia Interbancaria SPEI
"""

import re
import uuid
import html
from datetime import datetime
from typing import Dict, Any
from email.message import Message
from email.header import decode_header
from .logger import logger

class TransferProcessor:
    """Clase para procesar correos con notificaciones de Transferencia Interbancaria SPEI"""

    def __init__(self):
        """Inicializa el procesador de transferencias"""
        logger.info("Procesador de transferencias SPEI inicializado")

    def _clean_html_text(self, text: str) -> str:
        """
        Limpia etiquetas HTML y caracteres especiales de un texto

        Args:
            text: Texto con posibles etiquetas HTML

        Returns:
            str: Texto limpio sin HTML
        """
        if not text:
            return ""

        # Decodificar entidades HTML
        text = html.unescape(text)

        # Eliminar etiquetas HTML
        text = re.sub(r'<[^>]+>', '', text)

        # Eliminar estilos CSS residuales que puedan quedar después de limpiar HTML
        # Primero eliminar fragmentos CSS comunes que aparecen al inicio del texto
        # (ej: "dth: 46%; text-align: left; arbol de Navidad")
        text = re.sub(r'^[a-zA-Z-]+\s*:\s*\d+%?\s*;?\s*', '', text)  # Eliminar "dth: 46%;" al inicio
        text = re.sub(r'^[a-zA-Z-]+\s*-\s*[a-zA-Z-]+\s*:\s*[^;:]+[;:]?\s*', '', text)  # Eliminar "text-align: left;" al inicio
        
        # Eliminar propiedades CSS comunes en cualquier posición
        css_properties = ['text-align', 'vertical-align', 'text-decoration', 'font-weight', 
                         'font-size', 'font-family', 'color', 'background-color', 'background',
                         'padding', 'margin', 'border', 'display', 'width', 'height', 'dth']
        
        for prop in css_properties:
            # Eliminar propiedades CSS con sus valores (ej: "text-align: left;", "dth: 46%;")
            text = re.sub(rf'\b{re.escape(prop)}\s*:\s*[^;:]+[;:]?\s*', '', text, flags=re.IGNORECASE)
        
        # Eliminar porcentajes sueltos que puedan quedar de CSS (ej: "46%")
        text = re.sub(r'\b\d+%\s*', '', text)
        
        # Eliminar caracteres especiales HTML residuales
        text = re.sub(r'[<>"&]', '', text)
        
        # Limpiar espacios múltiples y caracteres especiales
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def is_transfer_email(self, subject: str) -> bool:
        """
        Identifica si un correo es una notificación de Transferencia Interbancaria SPEI

        Args:
            subject: Asunto del correo (posiblemente codificado)

        Returns:
            bool: True si es una transferencia SPEI, False en caso contrario
        """
        # Decodificar el subject si está codificado
        decoded_subject = subject
        try:
            decoded_parts = decode_header(subject)
            decoded_subject = ''
            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    if encoding:
                        decoded_subject += part.decode(encoding, errors='ignore')
                    else:
                        decoded_subject += part.decode('utf-8', errors='ignore')
                else:
                    decoded_subject += part
        except Exception as e:
            logger.warning(f"Error decodificando subject: {e}")
            decoded_subject = subject

        logger.info(f"Subject original: {subject}")
        logger.info(f"Subject decodificado: {decoded_subject}")

        # Hacer la búsqueda case-insensitive y más flexible
        decoded_subject_lower = decoded_subject.lower()
        is_transfer = (
            "transferencia interbancaria spei" in decoded_subject_lower or
            "transferencia interbancaria" in decoded_subject_lower or
            "spei" in decoded_subject_lower and "transferencia" in decoded_subject_lower
        )
        
        logger.info(f"¿Es correo de transferencia SPEI? {is_transfer}")
        return is_transfer

    def extract_transfer_info(self, msg: Message) -> Dict[str, Any]:
        """
        Extrae información de transferencia SPEI del cuerpo del correo

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            Dict con información de la transferencia
        """
        try:
            logger.info("Iniciando extracción de información de transferencia SPEI")

            # Extraer el cuerpo del correo
            body = ""
            if msg.is_multipart():
                logger.info("Correo es multipart, procesando partes...")
                for part in msg.walk():
                    # PRIORIDAD: Buscar HTML primero, luego texto plano
                    if part.get_content_type() == "text/html":
                        try:
                            body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                            logger.info(f"Cuerpo HTML extraído (multipart): {len(body)} caracteres")
                            logger.info("✅ Usando parte HTML del correo")
                            break
                        except Exception as e:
                            logger.warning(f"Error decodificando HTML: {e}")
                            continue
                    elif part.get_content_type() == "text/plain":
                        try:
                            body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                            logger.info(f"Cuerpo texto extraído (multipart): {len(body)} caracteres")
                            logger.info("⚠️ Usando parte texto plano (sin HTML)")
                            break
                        except Exception as e:
                            logger.warning(f"Error decodificando texto plano: {e}")
                            body = str(part.get_payload(decode=True), errors='ignore')
                            break
            else:
                logger.info("Correo no es multipart, extrayendo payload directo...")
                try:
                    body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                    content_type = msg.get_content_type()
                    logger.info(f"Cuerpo extraído ({content_type}): {len(body)} caracteres")
                except Exception as e:
                    logger.warning(f"Error decodificando cuerpo: {e}")
                    body = str(msg.get_payload(decode=True), errors='ignore')

            # Log del cuerpo para depuración (primeros 200 caracteres)
            logger.info(f"Primeros 200 caracteres del cuerpo: {body[:200]}")

            # Limpiar HTML si es necesario - Mejorar detección de HTML
            body_lower = body.lower()
            has_html = (
                '<!doctype html' in body_lower or 
                '<html' in body_lower or 
                '<td>' in body_lower or 
                '<table' in body_lower or
                '<div' in body_lower or
                body.strip().startswith('<!DOCTYPE') or
                body.strip().startswith('<!doctype')
            )
            
            if has_html:
                logger.info("📄 Detectado HTML, limpiando etiquetas...")
                body = self._clean_html_text(body)
                logger.info(f"Cuerpo limpio: {len(body)} caracteres")
                logger.info(f"Primeros 200 caracteres del cuerpo limpio: {body[:200]}")
            else:
                logger.debug("Correo no contiene HTML o ya está en texto plano")

            # Decodificar el asunto del correo
            subject = msg.get('subject', 'Sin asunto')
            try:
                decoded_parts = decode_header(subject)
                decoded_subject = ''
                for part, encoding in decoded_parts:
                    if isinstance(part, bytes):
                        if encoding:
                            decoded_subject += part.decode(encoding, errors='ignore')
                        else:
                            decoded_subject += part.decode('utf-8', errors='ignore')
                    else:
                        decoded_subject += part
                subject = decoded_subject
                logger.info(f"Asunto decodificado: '{subject}'")
            except Exception as e:
                logger.warning(f"Error decodificando subject: {e}")
                pass

            # Extraer información usando expresiones regulares
            # Usar la misma estructura que los depósitos para compatibilidad
            transfer_info = {
                'idmov': str(uuid.uuid4()),
                'fc': datetime.now().isoformat(),
                'asunto': subject,
                'fecOperacion': None,
                'horaOperacion': None,
                'ordenante': None,
                'ctaDestino': None,
                'bcoDestino': None,
                'beneficiario': None,
                'importe': None,
                'moneda': None,
                'cancepto': None,
                'referencia': None,
                'rastreo': None,
                'autorizacion': None,
                'bancoEmisor': None,
                'tipo': 'Transferencia SPEI',
                'aplicado': False,
                'manual': False,
                'Operacion': 'Transferencia Interbancaria SPEI'
            }

            # Fecha de Operación: DD-MMM-YYYY (ej: 22-Dic-2025)
            fecha_patterns = [
                r'Fecha de Operación:\s*(\d{2}-[A-Za-z]{3}-\d{4})',
                r'Fecha de Operación[:\s]+(\d{2}-[A-Za-z]{3}-\d{4})',
                r'Fecha[:\s]+(\d{2}-[A-Za-z]{3}-\d{4})',
            ]
            
            for pattern in fecha_patterns:
                fecha_match = re.search(pattern, body, re.IGNORECASE)
                if fecha_match:
                    fecha_str = fecha_match.group(1)
                    # Convertir de DD-MMM-YYYY a YYYY-MM-DD
                    try:
                        fecha_dt = datetime.strptime(fecha_str, '%d-%b-%Y')
                        transfer_info['fecOperacion'] = fecha_dt.strftime('%Y-%m-%d')
                        logger.info(f"✅ Fecha de operación extraída: {transfer_info['fecOperacion']}")
                        break
                    except:
                        # Intentar con meses en español
                        meses = {'Ene': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Abr': 'Apr',
                                'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Ago': 'Aug',
                                'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dic': 'Dec'}
                        for mes_es, mes_en in meses.items():
                            fecha_str = fecha_str.replace(mes_es, mes_en)
                        try:
                            fecha_dt = datetime.strptime(fecha_str, '%d-%b-%Y')
                            transfer_info['fecOperacion'] = fecha_dt.strftime('%Y-%m-%d')
                            logger.info(f"✅ Fecha de operación extraída: {transfer_info['fecOperacion']}")
                            break
                        except:
                            logger.warning(f"No se pudo parsear la fecha: {fecha_str}")

            # Hora de Operación: HH:MM:SS horas (ej: 11:40:10 horas)
            hora_patterns = [
                r'Hora de Operación:\s*(\d{2}:\d{2}:\d{2})\s*horas',
                r'Hora de Operación[:\s]+(\d{2}:\d{2}:\d{2})\s*horas',
                r'Hora[:\s]+(\d{2}:\d{2}:\d{2})\s*horas',
            ]
            
            for pattern in hora_patterns:
                hora_match = re.search(pattern, body, re.IGNORECASE)
                if hora_match:
                    transfer_info['horaOperacion'] = hora_match.group(1)
                    logger.info(f"✅ Hora de operación extraída: {transfer_info['horaOperacion']}")
                    break

            # Cuenta Origen (no se guarda en la BD, solo para logging)
            cuenta_origen_patterns = [
                r'Cuenta Origen:\s*([^\n\r]*?)(?:\s+Nombre|$)',
                r'Cuenta Origen[:\s]+([^\n\r]*?)(?:\s+Nombre|$)',
                r'Cuenta Origen[:\s]+([^\n\r]+)',
            ]
            
            cuenta_origen = None
            for pattern in cuenta_origen_patterns:
                cuenta_match = re.search(pattern, body, re.IGNORECASE)
                if cuenta_match:
                    cuenta_origen = cuenta_match.group(1).strip()
                    logger.info(f"✅ Cuenta origen extraída: {cuenta_origen}")
                    break

            # Nombre del Ordenante
            ordenante_patterns = [
                r'Nombre del Ordenante:\s*([^\n\r]*?)(?:\s+Cuenta|$)',
                r'Nombre del Ordenante[:\s]+([^\n\r]*?)(?:\s+Cuenta|$)',
                r'Ordenante[:\s]+([^\n\r]+)',
            ]
            
            for pattern in ordenante_patterns:
                ordenante_match = re.search(pattern, body, re.IGNORECASE)
                if ordenante_match:
                    transfer_info['ordenante'] = ordenante_match.group(1).strip()
                    logger.info(f"✅ Ordenante extraído: {transfer_info['ordenante']}")
                    break

            # Cuenta Destino
            cuenta_destino_patterns = [
                r'Cuenta Destino:\s*([^\n\r]*?)(?:\s+Banco|$)',
                r'Cuenta Destino[:\s]+([^\n\r]*?)(?:\s+Banco|$)',
                r'Cuenta Destino[:\s]+([^\n\r]+)',
            ]
            
            for pattern in cuenta_destino_patterns:
                cuenta_match = re.search(pattern, body, re.IGNORECASE)
                if cuenta_match:
                    transfer_info['ctaDestino'] = cuenta_match.group(1).strip()
                    logger.info(f"✅ Cuenta destino extraída: {transfer_info['ctaDestino']}")
                    break

            # Banco Destino
            banco_destino_patterns = [
                r'Banco Destino:\s*([^\n\r]*?)(?:\s+Nombre|$)',
                r'Banco Destino[:\s]+([^\n\r]*?)(?:\s+Nombre|$)',
                r'Banco Destino[:\s]+([^\n\r]+)',
            ]
            
            for pattern in banco_destino_patterns:
                banco_match = re.search(pattern, body, re.IGNORECASE)
                if banco_match:
                    transfer_info['bcoDestino'] = banco_match.group(1).strip()
                    logger.info(f"✅ Banco destino extraído: {transfer_info['bcoDestino']}")
                    break

            # Nombre del Beneficiario
            beneficiario_patterns = [
                r'Nombre del Beneficiario:\s*([^\n\r]*?)(?:\s+Aplicar|$)',
                r'Nombre del Beneficiario[:\s]+([^\n\r]*?)(?:\s+Aplicar|$)',
                r'Beneficiario[:\s]+([^\n\r]+)',
            ]
            
            for pattern in beneficiario_patterns:
                beneficiario_match = re.search(pattern, body, re.IGNORECASE)
                if beneficiario_match:
                    transfer_info['beneficiario'] = beneficiario_match.group(1).strip()
                    logger.info(f"✅ Beneficiario extraído: {transfer_info['beneficiario']}")
                    break

            # Aplicar (ej: Mismo Dia) - no se guarda en la BD, solo para logging
            aplicar_patterns = [
                r'Aplicar:\s*([^\n\r]*?)(?:\s+Importe|$)',
                r'Aplicar[:\s]+([^\n\r]*?)(?:\s+Importe|$)',
                r'Aplicar[:\s]+([^\n\r]+)',
            ]
            
            aplicar = None
            for pattern in aplicar_patterns:
                aplicar_match = re.search(pattern, body, re.IGNORECASE)
                if aplicar_match:
                    aplicar = aplicar_match.group(1).strip()
                    logger.info(f"✅ Aplicar extraído: {aplicar}")
                    break

            # Importe - PATRONES PARA MULTIPLES MONEDAS (MN, USD, EUR, etc.)
            importe_patterns = [
                # Patrones que capturan monto y moneda juntos
                r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',
                r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',
                r'\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',
                # Patrones específicos para moneda mexicana (MN)
                r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*MN',
                r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*MN',
                r'\$\s*([\d,]+\.\d{2})\s*MN',
            ]

            moneda_encontrada = False
            for pattern in importe_patterns:
                importe_match = re.search(pattern, body, re.IGNORECASE)
                if importe_match:
                    # Si el patrón tiene 2 grupos (monto y moneda)
                    if len(importe_match.groups()) == 2:
                        importe_str = importe_match.group(1).replace(',', '')
                        moneda = importe_match.group(2).upper()
                    else:
                        importe_str = importe_match.group(1).replace(',', '')
                        moneda = 'MN'  # Default para México si no se especifica

                    try:
                        transfer_info['importe'] = float(importe_str)

                        # Convertir MN a MXN y siempre incluir columna moneda
                        if moneda.upper() == 'MN':
                            moneda_final = 'MXN'
                        else:
                            moneda_final = moneda.upper()

                        transfer_info['moneda'] = moneda_final
                        logger.info(f"✅ Importe extraído: ${transfer_info['importe']:,.2f} {moneda_final}")

                        moneda_encontrada = True
                        break
                    except:
                        logger.warning(f"No se pudo parsear el importe: {importe_str}")

            # Si no se encontró ningún patrón, registrar advertencia
            if not moneda_encontrada:
                logger.warning("No se encontró información de importe en el correo")

            # Concepto de Pago - PATRONES PRECISOS (termina donde inicia Referencia)
            concepto_patterns = [
                r'Concepto de Pago:\t+([^\n\r\t]*?)\s*Referencia',  # Tabulaciones - todo antes de Referencia
                r'Concepto de Pago:\s+([^\n\r]*?)\s*Referencia',    # Espacios - todo antes de Referencia
                r'Concepto de Pago:\s*([^\n\r]*?)\s*Referencia',    # Espacio simple - todo antes de Referencia
                r'Concepto de Pago:([^\n\r]*?)\s*Referencia',       # Directo - todo antes de Referencia
            ]

            for pattern in concepto_patterns:
                concepto_match = re.search(pattern, body, re.IGNORECASE)
                if concepto_match:
                    concepto_raw = concepto_match.group(1).strip()
                    # Limpiar HTML residual y estilos CSS que puedan quedar
                    transfer_info['cancepto'] = self._clean_html_text(concepto_raw)
                    logger.info(f"✅ Concepto extraído: {transfer_info['cancepto']}")
                    break

            # Referencia
            referencia_patterns = [
                r'Referencia:\s*([^\n\r]*?)(?:\s+Número|$)',
                r'Referencia[:\s]+([^\n\r]*?)(?:\s+Número|$)',
                r'Referencia[:\s]+([^\n\r]+)',
            ]

            for pattern in referencia_patterns:
                ref_match = re.search(pattern, body, re.IGNORECASE)
                if ref_match:
                    transfer_info['referencia'] = ref_match.group(1).strip()
                    logger.info(f"✅ Referencia extraída: {transfer_info['referencia']}")
                    break

            # Número de Autorización
            autorizacion_patterns = [
                r'Número de Autorización:\s*([^\n\r]*?)(?:\s+Clave|$)',
                r'Autorizaci(?:ón|on):\s*([^\n\r]*?)(?:\s+Clave|$)',
                r'Autorizaci(?:ón|on)[:\s]+([^\n\r]+)',
            ]

            for pattern in autorizacion_patterns:
                auth_match = re.search(pattern, body, re.IGNORECASE)
                if auth_match:
                    transfer_info['autorizacion'] = auth_match.group(1).strip()
                    logger.info(f"✅ Autorización extraída: {transfer_info['autorizacion']}")
                    break

            # Clave de Rastreo - MÚLTIPLES PATRONES
            rastreo_patterns = [
                r'Clave de Rastreo:\s+([A-Z0-9\-\/\.]+)',
                r'Clave de Rastreo[:\s]+([A-Z0-9\-\/\.]+)',
                r'Clave de Rastreo:([A-Z0-9\-\/\.]+)',
                r'(BNET[A-Z0-9]+)',
                r'\b([A-Z]{2}\d{13,})\b',  # Formato BB1738120020753
                r'\b([A-Z]{4}\d{20,30})\b',
                r'\b(\d{7,})\b',
            ]

            for pattern in rastreo_patterns:
                rastreo_match = re.search(pattern, body, re.IGNORECASE)
                if rastreo_match:
                    rastreo_value = rastreo_match.group(1).strip()
                    # Validación más flexible: aceptar diferentes formatos
                    if self._validate_clave_rastreo(rastreo_value):
                        transfer_info['rastreo'] = rastreo_value
                        logger.info(f"✅ Clave de rastreo extraída: {rastreo_value}")
                        break
                    else:
                        logger.warning(f"Clave de rastreo con formato inválido: {rastreo_value}")

            logger.info(f"Información de transferencia SPEI extraída: {transfer_info}")
            return transfer_info

        except Exception as e:
            logger.error(f"Error al extraer información de transferencia SPEI: {str(e)}")
            import traceback
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return {
                'error': str(e),
                'processed': False
            }

    def _validate_clave_rastreo(self, clave: str) -> bool:
        """
        Valida si una clave de rastreo tiene un formato válido.

        Args:
            clave: Clave de rastreo a validar

        Returns:
            bool: True si es válida, False si no
        """
        if not clave:
            return False

        # Eliminar espacios en blanco
        clave = clave.strip()

        # Caso 1: Formato con guiones/diagonales (ej: 058-05/12/2025/05-001ULFK589)
        if '-' in clave or '/' in clave:
            return len(clave) >= 15 and any(c.isalnum() for c in clave)

        # Caso 2: Formato BNET (ej: BNET01002512150049564834)
        if clave.startswith('BNET'):
            return len(clave) >= 20

        # Caso 3: Formato BB + números (ej: BB1738120020753)
        if clave.startswith('BB') and len(clave) >= 13:
            return True

        # Caso 4: Números puros (ej: 1234567890)
        if clave.isdigit():
            return len(clave) >= 7

        # Caso 5: Formato alfanumérico general
        return len(clave) >= 10 and any(c.isalpha() for c in clave) and any(c.isdigit() for c in clave)

    def process_transfer_email(self, msg: Message) -> Dict[str, Any]:
        """
        Procesa un correo de transferencia SPEI y extrae la información

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            Dict con información extraída y estadísticas
        """
        result = {
            'processed': False,
            'data': None,
            'errors': 0,
            'message': 'Correo de transferencia SPEI recibido pero no procesado'
        }

        try:
            # Obtener asunto
            subject = msg.get('subject', 'Sin asunto')

            # Verificar que sea un correo de transferencia
            if not self.is_transfer_email(subject):
                result['message'] = 'El correo no es una notificación de Transferencia Interbancaria SPEI'
                return result

            logger.info(f"Procesando correo de transferencia SPEI: {subject}")

            # Extraer información de la transferencia
            logger.info("A punto de llamar a extract_transfer_info()...")
            transfer_info = self.extract_transfer_info(msg)
            logger.info("extract_transfer_info() ejecutado correctamente")

            if 'error' in transfer_info:
                result['errors'] = 1
                result['message'] = f'Error al extraer información: {transfer_info["error"]}'
                return result

            # Validar información mínima requerida
            if not transfer_info.get('rastreo'):
                result['errors'] = 1
                result['message'] = 'No se encontró la clave de rastreo'
                return result

            result['data'] = transfer_info
            result['processed'] = True
            result['message'] = 'Correo de transferencia SPEI procesado exitosamente'

            logger.info(f"Correo de transferencia SPEI procesado: {subject}")
            return result

        except Exception as e:
            logger.error(f"Error al procesar correo de transferencia SPEI: {str(e)}")
            import traceback
            logger.error(f"Traceback completo en process_transfer_email: {traceback.format_exc()}")
            result['errors'] = 1
            result['message'] = f'Error al procesar correo de transferencia SPEI: {str(e)}'

        return result

