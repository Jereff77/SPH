#!/usr/bin/env python3
"""
Script para listar todas las carpetas disponibles en la cuenta de correo
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.config import Config
from src.logger import logger
from src.email_client import EmailClient

def main():
    logger.info("Listando carpetas de la cuenta de correo...")

    # Crear cliente de correo
    email_client = EmailClient()

    # Conectar
    if not email_client.connect():
        logger.error("No se pudo conectar al servidor IMAP")
        return

    # Seleccionar INBOX
    if not email_client.select_inbox():
        logger.error("No se pudo seleccionar INBOX")
        return

    # Listar todas las carpetas
    try:
        status, folders = email_client.imap_server.list()
        if status == 'OK':
            logger.info(f"\n=== CARPETAS ENCONTRADAS ===")
            for i, folder in enumerate(folders):
                folder_str = folder.decode() if isinstance(folder, bytes) else folder
                logger.info(f"{i+1}. {folder_str}")

                # Intentar extraer el nombre limpio
                if '"' in folder_str:
                    parts = folder_str.split('"')
                    if len(parts) >= 3:
                        clean_name = parts[-2] if parts[-2] else parts[1]
                        logger.info(f"   Nombre limpio: '{clean_name}'")

            # Buscar específicamente la carpeta Procesados
            logger.info(f"\n=== BUSCANDO CARPETA 'PROCESADOS' ===")
            for folder in folders:
                folder_str = folder.decode() if isinstance(folder, bytes) else folder
                if 'procesad' in folder_str.lower():
                    logger.info(f"¡CARPETA ENCONTRADA! -> {folder_str}")

                    # Probar seleccionarla
                    try:
                        status, count = email_client.imap_server.select(folder_str)
                        if status == 'OK':
                            logger.info(f"   Carpeta seleccionable, contiene {count} mensajes")
                        else:
                            logger.warning(f"   No se pudo seleccionar la carpeta: {status}")
                    except Exception as e:
                        logger.error(f"   Error al seleccionar carpeta: {str(e)}")

                    # Volver a INBOX
                    email_client.select_inbox()

        else:
            logger.error(f"Error al listar carpetas: {folders}")

    except Exception as e:
        logger.error(f"Error: {str(e)}")

    # Desconectar
    email_client.disconnect()
    logger.info("\nProceso completado")

if __name__ == "__main__":
    main()