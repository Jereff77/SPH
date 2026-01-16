#!/usr/bin/env python3
"""
Script completo para diagnosticar el sistema de procesamiento de correos
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from src.email_client import EmailClient
from src.deposit_processor import DepositProcessor
from src.supabase_client import SupabaseClient
from src.logger import logger

def diagnosticar_sistema():
    """Diagnóstico completo del sistema"""

    logger.info("=== INICIANDO DIAGNÓSTICO COMPLETO DEL SISTEMA ===\n")

    # 1. Conexión a Supabase
    logger.info("1. Probando conexión a Supabase...")
    try:
        supabase = SupabaseClient()
        logger.info("✅ Conexión a Supabase establecida")

        # Verificar tabla movbancarios
        try:
            response = supabase.client.table("movbancarios").select("*").limit(1).execute()
            logger.info(f"✅ Tabla movbancarios accesible: {'Encontrados datos' if response.data else 'Tabla vacía'}")
        except Exception as e:
            logger.error(f"❌ Error accediendo a tabla movbancarios: {e}")
    except Exception as e:
        logger.error(f"❌ Error conectando a Supabase: {e}")
        return

    # 2. Conexión a correo
    logger.info("\n2. Probando conexión IMAP...")
    email_client = EmailClient()
    if not email_client.connect():
        logger.error("❌ No se pudo conectar al servidor IMAP")
        return
    logger.info("✅ Conexión IMAP establecida")

    # 3. Obtener correos no leídos
    logger.info("\n3. Obteniendo correos no leídos...")
    try:
        unread_emails = email_client.get_unread_emails()
        logger.info(f"✅ Se encontraron {len(unread_emails)} correos no leídos")
    except Exception as e:
        logger.error(f"❌ Error obteniendo correos: {e}")
        email_client.disconnect()
        return

    if not unread_emails:
        logger.info("⚠️ No hay correos no leídos para procesar")
        email_client.disconnect()
        return

    # 4. Analizar cada correo
    logger.info("\n4. Analizando correos encontrados...")
    deposit_processor = DepositProcessor()

    deposit_stats = {
        'encontrados': 0,
        'procesados': 0,
        'insertados': 0,
        'duplicados': 0,
        'errores': 0
    }

    for i, (email_id, msg) in enumerate(unread_emails[:10]):  # Limitar a primeros 10
        logger.info(f"\n--- Correo {i+1}/10 ---")

        try:
            # Obtener info del correo
            email_info = email_client.get_email_info(msg)
            subject = email_info['subject']
            from_addr = email_info['from']
            is_bank = email_info['is_bank']

            logger.info(f"Asunto: {subject}")
            logger.info(f"Remitente: {from_addr}")
            logger.info(f"Es banco: {is_bank}")

            # Verificar si es depósito
            is_deposit = deposit_processor.is_deposit_email(subject)
            logger.info(f"¿Es depósito?: {is_deposit}")

            if is_deposit:
                deposit_stats['encontrados'] += 1
                logger.info("🏦 Procesando correo de depósito...")

                # Procesar depósito
                result = deposit_processor.process_deposit_email(msg)
                logger.info(f"Resultado del procesamiento: {result}")

                if result['processed'] and result['data']:
                    deposit_stats['procesados'] += 1

                    # Verificar datos extraídos
                    data = result['data']
                    logger.info("Datos extraídos:")
                    for key, value in data.items():
                        if value:
                            logger.info(f"  - {key}: {value}")

                    # Verificar si ya existe en Supabase
                    if data.get('rastreo'):
                        existing = supabase.get_movimiento_by_rastreo(data['rastreo'])
                        if existing:
                            deposit_stats['duplicados'] += 1
                            logger.warning(f"⚠️ Depósito duplicado: {data['rastreo']}")
                            continue

                    # Intentar insertar
                    logger.info("💾 Intentando insertar en Supabase...")
                    insert_result = supabase.insert_movimiento_bancario(data)
                    if insert_result:
                        deposit_stats['insertados'] += 1
                        logger.info("✅ Depósito insertado correctamente")

                        # Intentar marcar como leído
                        logger.info("📧 Intentando marcar correo como leído...")
                        if email_client.mark_email_as_read(email_id):
                            logger.info("✅ Correo marcado como leído")

                            # Intentar mover a carpeta
                            logger.info("📁 Intentando mover a carpeta 'BanBajio'...")
                            if email_client.move_email_to_folder(email_id, 'BanBajio'):
                                logger.info("✅ Correo movido a 'BanBajio'")
                            else:
                                logger.warning("⚠️ No se pudo mover correo a 'BanBajio'")
                        else:
                            logger.warning("⚠️ No se pudo marcar correo como leído")
                    else:
                        logger.error("❌ Error al insertar depósito")
                        deposit_stats['errores'] += 1
                else:
                    logger.error("❌ Error al procesar depósito")
                    deposit_stats['errores'] += 1
            else:
                logger.info("📄 Correo regular (no es depósito)")

        except Exception as e:
            logger.error(f"❌ Error procesando correo: {e}")
            import traceback
            logger.error(traceback.format_exc())
            deposit_stats['errores'] += 1

    # 5. Resumen
    logger.info("\n=== RESUMEN DEL DIAGNÓSTICO ===")
    logger.info(f"Correos analizados: {min(len(unread_emails), 10)}")
    logger.info(f"Depósitos encontrados: {deposit_stats['encontrados']}")
    logger.info(f"Depósitos procesados: {deposit_stats['procesados']}")
    logger.info(f"Depósitos insertados: {deposit_stats['insertados']}")
    logger.info(f"Depósitos duplicados: {deposit_stats['duplicados']}")
    logger.info(f"Errores: {deposit_stats['errores']}")

    if deposit_stats['encontrados'] == 0:
        logger.info("\n🔍 No se encontraron correos de depósito. Verificar:")
        logger.info("  - Asunto contiene 'Instrucción de depósito a tu cuenta'")
        logger.info("  - El subject no está codificado")

    if deposit_stats['errores'] > 0:
        logger.info(f"\n⚠️ Se encontraron {deposit_stats['errores']} errores. Revisar logs para detalles.")

    # 6. Desconexión
    email_client.disconnect()
    logger.info("\n=== DIAGNÓSTICO COMPLETADO ===")

if __name__ == "__main__":
    diagnosticar_sistema()