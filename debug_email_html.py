#!/usr/bin/env python3
"""
Script para obtener y analizar el HTML completo de un correo de depósito
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from src.email_client import EmailClient
from src.deposit_processor import DepositProcessor
from src.logger import logger

def debug_email_html():
    """Obtiene el HTML completo de un correo de depósito para análisis"""

    logger.info("=== OBTENIENDO HTML COMPLETO DE CORREO DE DEPÓSITO ===\n")

    # Conectar al servidor
    email_client = EmailClient()
    if not email_client.connect():
        logger.error("No se pudo conectar")
        return

    # Obtener correos
    unread_emails = email_client.get_unread_emails()
    if not unread_emails:
        logger.info("No hay correos no leídos")
        email_client.disconnect()
        return

    deposit_processor = DepositProcessor()

    # Buscar el primer correo de depósito
    for email_id, msg in unread_emails:
        subject = msg.get('subject', '')
        decoded_subject = subject

        # Decodificar subject si es necesario
        if '=?' in subject:
            from email.header import decode_header
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

        if deposit_processor.is_deposit_email(subject):
            logger.info(f"Correo de depósito encontrado: {decoded_subject}")

            # Obtener el cuerpo del correo
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/html":
                        try:
                            payload = part.get_payload(decode=True)
                            if payload:
                                charset = part.get_content_charset() or 'utf-8'
                                body = payload.decode(charset, errors='ignore')
                                break
                        except:
                            pass
            else:
                try:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        charset = msg.get_content_charset() or 'utf-8'
                        body = payload.decode(charset, errors='ignore')
                except:
                    body = str(msg.get_payload())

            # Guardar el HTML en un archivo
            with open('email_debug.html', 'w', encoding='utf-8') as f:
                f.write(body)

            logger.info(f"HTML guardado en email_debug.html")
            logger.info(f"Tamaño del HTML: {len(body)} caracteres")

            # Buscar "Clave de Rastreo" en el HTML
            import re
            rastreo_matches = re.findall(r'(?i)clave de rastreo', body)
            if rastreo_matches:
                logger.info(f"✅ Se encontró 'Clave de Rastreo' {len(rastreo_matches)} veces en el HTML")

                # Extraer contexto alrededor de "Clave de Rastreo"
                for match in re.finditer(r'(?i)(.{0,50}clave de rastreo.{0,100})', body):
                    logger.info(f"Contexto: {match.group()}")
            else:
                logger.warning("❌ No se encontró 'Clave de Rastreo' en el HTML")

                # Buscar variaciones
                variaciones = ['rastreo', 'tracking', 'clave', 'reference']
                for var in variaciones:
                    if re.search(var, body, re.IGNORECASE):
                        logger.info(f"Se encontró '{var}' en el HTML")

            # Buscar patrones que parezcan claves de rastreo
            patrones = [
                r'\b[A-Z0-9]{2,4}-[\d]{2}/[\d]{2}/[\d]{4}/[\d]{2}-[\d]{3}[A-Z0-9]+',  # Formato: XXX-DD/MM/YYYY/DD-XXXXX
                r'\b[A-Z0-9]{15,}',  # Cadenas alfanuméricas largas
                r'\b\d{3}-\d{2}/\d{2}/\d{4}/\d{2}-\d{3}[A-Z0-9]+',  # Formato numérico inicial
            ]

            logger.info("\nBuscando patrones de clave de rastreo:")
            for i, patron in enumerate(patrones):
                matches = re.findall(patron, body)
                if matches:
                    logger.info(f"Patrón {i+1}: {len(matches)} coincidencias")
                    for match in matches[:3]:  # Solo primeras 3
                        logger.info(f"  - {match}")

            # Buscar tablas que puedan contener los datos
            logger.info("\nBuscando tablas en el HTML:")
            td_content = re.findall(r'<td[^>]*>([^<]+)</td>', body, re.IGNORECASE)
            if td_content:
                logger.info(f"Se encontraron {len(td_content)} celdas <td>")

                # Buscar celdas que puedan contener los datos que necesitamos
                keywords = ['fecha', 'hora', 'cuenta', 'destino', 'ordenante', 'banco', 'emisor', 'importe', 'concepto', 'rastreo', 'referencia', 'autorización']
                for keyword in keywords:
                    for i, cell in enumerate(td_content):
                        if keyword.lower() in cell.lower():
                            # Mostrar la celda y la siguiente (que podría ser el valor)
                            logger.info(f"  {keyword}: {cell.strip()}")
                            if i + 1 < len(td_content):
                                logger.info(f"    Valor: {td_content[i+1].strip()}")

            break

    email_client.disconnect()
    logger.info("\n=== ANÁLISIS COMPLETADO ===")

if __name__ == "__main__":
    debug_email_html()