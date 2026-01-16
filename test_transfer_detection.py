#!/usr/bin/env python3
"""
Script para probar la detección de correos de transferencia SPEI
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from src.email_client import EmailClient
from src.transfer_processor import TransferProcessor
from src.logger import logger

def test_transfer_detection():
    """Prueba la detección de correos de transferencia"""
    
    logger.info("=== PRUEBA DE DETECCIÓN DE TRANSFERENCIAS SPEI ===")
    
    # Inicializar cliente de correo
    email_client = EmailClient()
    transfer_processor = TransferProcessor()
    
    try:
        # Conectar
        if not email_client.connect():
            logger.error("No se pudo conectar al servidor de correo")
            return
        
        # Seleccionar bandeja de entrada
        if not email_client.select_inbox():
            logger.error("No se pudo seleccionar la bandeja de entrada")
            return
        
        # Obtener TODOS los correos (no solo no leídos)
        logger.info("Buscando correos en la bandeja de entrada...")
        status, email_ids = email_client.imap_server.search(None, 'ALL')
        
        if status != 'OK':
            logger.error("Error al buscar correos")
            return
        
        email_id_list = email_ids[0].split()
        logger.info(f"Se encontraron {len(email_id_list)} correos en total")
        
        # Revisar los últimos 20 correos
        email_id_list = email_id_list[-20:] if len(email_id_list) > 20 else email_id_list
        email_id_list.reverse()
        
        transfer_found = 0
        deposit_found = 0
        
        for email_id in email_id_list:
            try:
                # Obtener el correo
                status, msg_data = email_client.imap_server.fetch(email_id, '(BODY.PEEK[HEADER])')
                
                if status == 'OK':
                    raw_email = msg_data[0][1]
                    import email
                    msg = email.message_from_bytes(raw_email)
                    
                    subject = msg.get('subject', 'Sin asunto')
                    from_addr = msg.get('from', 'Remitente desconocido')
                    
                    # Probar detección
                    is_transfer = transfer_processor.is_transfer_email(subject)
                    
                    if is_transfer:
                        transfer_found += 1
                        logger.info(f"✅ TRANSFERENCIA SPEI ENCONTRADA:")
                        logger.info(f"   Subject: {subject}")
                        logger.info(f"   From: {from_addr}")
                        logger.info(f"   Email ID: {email_id}")
                    
                    # También verificar depósitos
                    from src.deposit_processor import DepositProcessor
                    deposit_processor = DepositProcessor()
                    is_deposit = deposit_processor.is_deposit_email(subject)
                    
                    if is_deposit:
                        deposit_found += 1
                        logger.info(f"✅ DEPÓSITO ENCONTRADO:")
                        logger.info(f"   Subject: {subject}")
                        logger.info(f"   From: {from_addr}")
                        logger.info(f"   Email ID: {email_id}")
                    
                    # Mostrar todos los asuntos para debug
                    logger.info(f"   Asunto: {subject[:100]}")
                    
            except Exception as e:
                logger.error(f"Error al procesar correo {email_id}: {e}")
                continue
        
        logger.info(f"\n=== RESUMEN ===")
        logger.info(f"Correos revisados: {len(email_id_list)}")
        logger.info(f"Transferencias SPEI encontradas: {transfer_found}")
        logger.info(f"Depósitos encontrados: {deposit_found}")
        
    except Exception as e:
        logger.error(f"Error en la prueba: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        email_client.disconnect()

if __name__ == "__main__":
    test_transfer_detection()

