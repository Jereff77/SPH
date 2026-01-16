"""
Módulo para procesamiento de correos de instrucciones de depósito
"""

import re
import uuid
import html
from datetime import datetime
from typing import Dict, Any, Optional
from email.message import Message
from email.header import decode_header
from .logger import logger

class DepositProcessor:
    """Clase para procesar correos con instrucciones de depósito bancario"""

    def __init__(self):
        """Inicializa el procesador de depósitos"""
        logger.info("Procesador de depósitos inicializado")

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

    def is_deposit_email(self, subject: str) -> bool:
        """
        Identifica si un correo es una instrucción de depósito

        Args:
            subject: Asunto del correo (posiblemente codificado)

        Returns:
            bool: True si es una instrucción de depósito, False en caso contrario
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

        return "Instrucción de depósito a tu cuenta" in decoded_subject

    def extract_deposit_info(self, msg: Message) -> Dict[str, Any]:
        """
        Extrae información de depósito del cuerpo del correo

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            Dict con información de la transferencia
        """
        try:
            logger.info("Iniciando extracción de información de depósito")

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

            # Limpiar HTML si es necesario
            # Mejorar detección de HTML - incluir DOCTYPE y otras etiquetas comunes
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
                logger.info("📄 Detectado HTML, limpiendo etiquetas...")
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
                # Si falla, usar el subject original
                pass

            # Extraer información usando expresiones regulares
            deposit_info = {
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
                'moneda': None,  # Agregando campo para detectar la moneda (MN, USD, EUR, etc.)
                'cancepto': None,  # Nota: El campo en la BD tiene error tipográfico
                'referencia': None,
                'rastreo': None,
                'autorizacion': None,
                'bancoEmisor': None,
                'tipo': 'Depósito',
                'aplicado': False,
                'manual': False,
                'Operacion': 'Transferencia Interbancaria SPEI'
            }

            # Fecha de Operación: DD-MMM-YYYY
            fecha_match = re.search(r'Fecha de Operación:\s*(\d{2}-[A-Za-z]{3}-\d{4})', body)
            if fecha_match:
                fecha_str = fecha_match.group(1)
                # Convertir de DD-MMM-YYYY a YYYY-MM-DD
                try:
                    fecha_dt = datetime.strptime(fecha_str, '%d-%b-%Y')
                    deposit_info['fecOperacion'] = fecha_dt.strftime('%Y-%m-%d')
                except:
                    # Intentar con meses en español
                    meses = {'Ene': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Abr': 'Apr',
                            'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Ago': 'Aug',
                            'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dic': 'Dec'}
                    for mes_es, mes_en in meses.items():
                        fecha_str = fecha_str.replace(mes_es, mes_en)
                    try:
                        fecha_dt = datetime.strptime(fecha_str, '%d-%b-%Y')
                        deposit_info['fecOperacion'] = fecha_dt.strftime('%Y-%m-%d')
                    except:
                        logger.warning(f"No se pudo parsear la fecha: {fecha_str}")

            # Hora de Operación: HH:MM:SS horas
            hora_match = re.search(r'Hora de Operación:\s*(\d{2}:\d{2}:\d{2})\s*horas', body)
            if hora_match:
                deposit_info['horaOperacion'] = hora_match.group(1)

            # Cuenta Destino - PATRONES PRECISOS (termina donde inicia Nombre del Ordenante)
            cuenta_patterns = [
                r'Cuenta Destino:\t+([^\n\r\t]*?)\s*Nombre',  # Tabulaciones - todo antes de Nombre
                r'Cuenta Destino:\s+([^\n\r]*?)\s*Nombre',    # Espacios - todo antes de Nombre
                r'Cuenta Destino:\s*([^\n\r]*?)\s*Nombre',    # Espacio simple - todo antes de Nombre
                r'Cuenta Destino:([^\n\r]*?)\s*Nombre',       # Directo - todo antes de Nombre
            ]

            for pattern in cuenta_patterns:
                cuenta_match = re.search(pattern, body, re.IGNORECASE)
                if cuenta_match:
                    deposit_info['ctaDestino'] = cuenta_match.group(1).strip()
                    logger.info(f"✅ Cuenta destino extraída: {deposit_info['ctaDestino']}")
                    break

            # Nombre del Ordenante - PATRONES PRECISOS (termina donde inicia Banco Emisor)
            ordenante_patterns = [
                r'Nombre del Ordenante:\t+([^\n\r\t]*?)\s*Banco',  # Tabulaciones - todo antes de Banco
                r'Nombre del Ordenante:\s+([^\n\r]*?)\s*Banco',    # Espacios - todo antes de Banco
                r'Nombre del Ordenante:\s*([^\n\r]*?)\s*Banco',    # Espacio simple - todo antes de Banco
                r'Nombre del Ordenante:([^\n\r]*?)\s*Banco',       # Directo - todo antes de Banco
            ]

            for pattern in ordenante_patterns:
                ordenante_match = re.search(pattern, body, re.IGNORECASE)
                if ordenante_match:
                    deposit_info['ordenante'] = ordenante_match.group(1).strip()
                    logger.info(f"✅ Ordenante extraído: {deposit_info['ordenante']}")
                    break

            # Banco Emisor - PATRONES PRECISOS (termina donde inicia Importe)
            banco_patterns = [
                r'Banco Emisor:\t+([^\n\r\t]*?)\s*Importe:',  # Tabulaciones - todo antes de Importe
                r'Banco Emisor:\s+([^\n\r]*?)\s*Importe:',    # Espacios - todo antes de Importe
                r'Banco Emisor:\s*([^\n\r]*?)\s*Importe:',    # Espacio simple - todo antes de Importe
                r'Banco Emisor:([^\n\r]*?)\s*Importe:',       # Directo - todo antes de Importe
            ]

            for pattern in banco_patterns:
                banco_match = re.search(pattern, body, re.IGNORECASE)
                if banco_match:
                    deposit_info['bancoEmisor'] = banco_match.group(1).strip()
                    logger.info(f"✅ Banco emisor extraído: {deposit_info['bancoEmisor']}")
                    break

            # Importe - PATRONES PARA MULTIPLES MONEDAS (MN, USD, EUR, etc.)
            importe_patterns = [
                # Patrones que capturan monto y moneda juntos
                r'Importe:\t+\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',  # Tabulaciones con moneda
                r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',  # Espacios múltiples con moneda
                r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',   # Espacio simple con moneda
                r'\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',            # Solo monto y moneda
                # Patrones específicos para moneda mexicana (MN)
                r'Importe:\t+\$\s*([\d,]+\.\d{2})\s*MN',  # Tabulaciones MN
                r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*MN',  # Espacios múltiples MN
                r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*MN',   # Espacio simple MN
                r'\$\s*([\d,]+\.\d{2})\s*MN',            # Solo monto MN
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
                        deposit_info['importe'] = float(importe_str)

                        # Convertir MN a MXN y siempre incluir columna moneda
                        if moneda.upper() == 'MN':
                            moneda_final = 'MXN'
                        else:
                            moneda_final = moneda.upper()

                        deposit_info['moneda'] = moneda_final
                        logger.info(f"✅ Importe extraído: ${deposit_info['importe']:,.2f} {moneda_final}")

                        moneda_encontrada = True
                        break
                    except:
                        logger.warning(f"No se pudo parsear el importe: {importe_str}")

            # Si no se encontró ningún patrón, registrar advertencia
            if not moneda_encontrada:
                logger.warning("No se encontró información de importe en el correo")

            # Concepto de Pago - PATRONES PRECISOS (termina donde inicia Clave de Rastreo)
            concepto_patterns = [
                r'Concepto de Pago:\t+([^\n\r\t]*?)\s*Clave',  # Tabulaciones - todo antes de Clave
                r'Concepto de Pago:\s+([^\n\r]*?)\s*Clave',    # Espacios - todo antes de Clave
                r'Concepto de Pago:\s*([^\n\r]*?)\s*Clave',    # Espacio simple - todo antes de Clave
                r'Concepto de Pago:([^\n\r]*?)\s*Clave',       # Directo - todo antes de Clave
            ]

            for pattern in concepto_patterns:
                concepto_match = re.search(pattern, body, re.IGNORECASE)
                if concepto_match:
                    deposit_info['cancepto'] = concepto_match.group(1).strip()
                    logger.info(f"✅ Concepto extraído: {deposit_info['cancepto']}")
                    break

            # Clave de Rastreo - MÚLTIPLES PATRONES
            rastreo_patterns = [
                r'Clave de Rastreo:\t+([A-Z0-9\-\/\.]+)',  # Tabulaciones - incluye guiones, diagonales, puntos
                r'Clave de Rastreo:\s+([A-Z0-9\-\/\.]+)',  # Espacios múltiples - incluye caracteres especiales
                r'Clave de Rastreo:\s*([A-Z0-9\-\/\.]+)',  # Espacio simple - incluye caracteres especiales
                r'Clave de Rastreo:([A-Z0-9\-\/\.]+)',     # Directo - incluye caracteres especiales
                r'(BNET[A-Z0-9]+)',                         # Patrón específico BNET
                r'\b([A-Z]{4}\d{20,30})\b',               # Formato general
                r'\b(\d{7,})\b',                           # Números de 7+ dígitos
            ]

            for pattern in rastreo_patterns:
                rastreo_match = re.search(pattern, body, re.IGNORECASE)
                if rastreo_match:
                    rastreo_value = rastreo_match.group(1).strip()
                    # Validación más flexible: aceptar diferentes formatos
                    # - Formatos con guiones/diagonales: mínimo 15 caracteres (ej: 058-05/12/2025/05-001ULFK589)
                    # - Formatos BNET: mínimo 20 caracteres
                    # - Números puros: mínimo 10 dígitos
                    if self._validate_clave_rastreo(rastreo_value):
                        deposit_info['rastreo'] = rastreo_value
                        logger.info(f"✅ Clave de rastreo extraída: {rastreo_value}")
                        break
                    else:
                        logger.warning(f"Clave de rastreo con formato inválido: {rastreo_value}")

            # Referencia (si existe)
            ref_match = re.search(r'Referencia:</td>\s*<td[^>]*>([^<]+)', body)
            if not ref_match:
                ref_match = re.search(r'Referencia:\s*([^\n\r<]+)', body)
            if ref_match:
                deposit_info['referencia'] = self._clean_html_text(ref_match.group(1).strip())

            # Autorización (si existe)
            auth_match = re.search(r'Autorizaci(?:ón|on):</td>\s*<td[^>]*>([^<]+)', body)
            if not auth_match:
                auth_match = re.search(r'Autorizaci(?:ón|on):\s*([^\n\r<]+)', body)
            if auth_match:
                deposit_info['autorizacion'] = self._clean_html_text(auth_match.group(1).strip())

            # Si no se encontró el beneficiario, intentar extraerlo del saludo inicial
            if not deposit_info['beneficiario']:
                # Buscar después de "Hola " hasta el salto de línea
                saludo_match = re.search(r'Hola\s+([^\n\r]+)', body)
                if saludo_match:
                    deposit_info['beneficiario'] = self._clean_html_text(saludo_match.group(1).strip())

            logger.info(f"Información de depósito extraída: {deposit_info}")
            return deposit_info

        except Exception as e:
            logger.error(f"Error al extraer información de depósito: {str(e)}")
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

        # Caso 3: Números puros (ej: 1234567890)
        if clave.isdigit():
            return len(clave) >= 7

        # Caso 4: Formato alfanumérico general
        return len(clave) >= 10 and any(c.isalpha() for c in clave) and any(c.isdigit() for c in clave)

    def process_deposit_email(self, msg: Message) -> Dict[str, Any]:
        """
        Procesa un correo de depósito y extrae la información

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            Dict con información extraída y estadísticas
        """
        result = {
            'processed': False,
            'data': None,
            'errors': 0,
            'message': 'Correo de depósito recibido pero no procesado'
        }

        try:
            # Obtener asunto
            subject = msg.get('subject', 'Sin asunto')

            # Verificar que sea un correo de depósito
            if not self.is_deposit_email(subject):
                result['message'] = 'El correo no es una instrucción de depósito'
                return result

            logger.info(f"Procesando correo de depósito: {subject}")

            # Extraer información del depósito
            logger.info("A punto de llamar a extract_deposit_info()...")
            deposit_info = self.extract_deposit_info(msg)
            logger.info("extract_deposit_info() ejecutado correctamente")

            if 'error' in deposit_info:
                result['errors'] = 1
                result['message'] = f'Error al extraer información: {deposit_info["error"]}'
                return result

            # Validar información mínima requerida
            if not deposit_info.get('rastreo'):
                result['errors'] = 1
                result['message'] = 'No se encontró la clave de rastreo'
                return result

            result['data'] = deposit_info
            result['processed'] = True
            result['message'] = 'Correo de depósito procesado exitosamente'

            logger.info(f"Correo de depósito procesado: {subject}")
            return result

        except Exception as e:
            logger.error(f"Error al procesar correo de depósito: {str(e)}")
            import traceback
            logger.error(f"Traceback completo en process_deposit_email: {traceback.format_exc()}")
            result['errors'] = 1
            result['message'] = f'Error al procesar correo de depósito: {str(e)}'

        return result