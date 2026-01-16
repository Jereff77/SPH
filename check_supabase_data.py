#!/usr/bin/env python3
"""
Script para verificar datos en Supabase
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from src.supabase_client import SupabaseClient
from src.logger import logger

def check_supabase_data():
    """Verifica qué datos existen en Supabase"""

    logger.info("Conectando a Supabase...")

    # Inicializar cliente de Supabase
    try:
        supabase = SupabaseClient()
        logger.info("Cliente de Supabase inicializado correctamente")
    except Exception as e:
        logger.error(f"Error al inicializar Supabase: {e}")
        return

    # Verificar facturas
    logger.info("\n=== Verificando tabla catFacturas ===")
    try:
        response = supabase.client.table('catFacturas').select('*').limit(5).execute()
        if response.data:
            logger.info(f"Se encontraron {len(response.data)} facturas:")
            for factura in response.data:
                logger.info(f"  - {factura.get('folioCFDI', 'N/A')}: {factura.get('nombreEmisor', 'N/A')}")
        else:
            logger.info("No se encontraron facturas en la base de datos")
    except Exception as e:
        logger.error(f"Error al consultar facturas: {e}")

    # Verificar movimientos bancarios (tabla correcta: movbancarios)
    logger.info("\n=== Verificando tabla movbancarios ===")
    try:
        response = supabase.client.table('movbancarios').select('*').limit(10).execute()
        if response.data:
            logger.info(f"Se encontraron {len(response.data)} movimientos bancarios:")
            for mov in response.data:
                logger.info(f"  - {mov.get('rastreo', 'N/A')}: ${mov.get('importe', 0)} - {mov.get('ordenante', 'N/A')}")
        else:
            logger.info("No se encontraron movimientos bancarios en la base de datos")
    except Exception as e:
        logger.error(f"Error al consultar movimientos bancarios (movbancarios): {e}")

    # También intentar con movimientosBancarios por si existe
    logger.info("\n=== Verificando tabla movimientosBancarios ===")
    try:
        response = supabase.client.table('movimientosBancarios').select('*').limit(10).execute()
        if response.data:
            logger.info(f"Se encontraron {len(response.data)} movimientos bancarios:")
            for mov in response.data:
                logger.info(f"  - {mov.get('rastreo', 'N/A')}: ${mov.get('importe', 0)} - {mov.get('ordenante', 'N/A')}")
        else:
            logger.info("No se encontraron movimientos bancarios en la base de datos")
    except Exception as e:
        logger.error(f"Error al consultar movimientos bancarios (movimientosBancarios): {e}")

    # Verificar si existen otras tablas
    logger.info("\n=== Listando tablas disponibles ===")
    try:
        # Intentar obtener información de las tablas
        response = supabase.client.rpc('get_tables').execute()
        logger.info(f"Tablas: {response.data}")
    except Exception as e:
        logger.info(f"No se pudo listar tablas automáticamente: {e}")
        logger.info("Tablas conocidas: catFacturas, movimientosBancarios")

if __name__ == "__main__":
    check_supabase_data()