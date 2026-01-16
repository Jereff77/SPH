#!/usr/bin/env python3
"""
Script principal del sistema de procesamiento de facturas XML desde correo electrónico
"""

import sys
import signal
import argparse
from src.processor import FacturaProcessor
from src.config import Config
from src.logger import logger

def signal_handler(signum, frame):
    """Manejador de señales para detener el procesador gracefully"""
    logger.info("Señal de detención recibida")
    if 'processor' in globals():
        processor.stop_processing()
    sys.exit(0)

def main():
    """Función principal del script"""
    parser = argparse.ArgumentParser(description='Sistema de procesamiento de facturas XML desde correo')
    parser.add_argument('--mode', choices=['continuous', 'once'], default='continuous',
                       help='Modo de ejecución: continuous (default) o once')
    parser.add_argument('--test', action='store_true',
                       help='Ejecutar pruebas de conexión')
    parser.add_argument('--status', action='store_true',
                       help='Mostrar estado del sistema')
    
    args = parser.parse_args()
    
    # Configurar manejador de señales
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Validar configuración
        Config.validate_config()
        
        # Crear instancia del procesador
        global processor
        processor = FacturaProcessor()
        
        if args.test:
            # Modo prueba
            logger.info("Ejecutando pruebas de conexión...")
            if processor._test_connections():
                logger.info("Todas las conexiones son exitosas")
                return 0
            else:
                logger.error("Error en las conexiones")
                return 1
        
        elif args.status:
            # Modo estado
            status = processor.get_status()
            print("\n=== ESTADO DEL SISTEMA ===")
            print(f"Procesador activo: {'SI' if status['running'] else 'NO'}")
            print(f"Facturas en BD: {status.get('facturas_en_db', 'N/A')}")
            print("\n=== CONFIGURACIÓN ===")
            config = status.get('config', {})
            print(f"Servidor IMAP: {config.get('imap_server', 'N/A')}:{config.get('imap_port', 'N/A')}")
            print(f"Usuario IMAP: {config.get('imap_user', 'N/A')}")
            print(f"URL Supabase: {config.get('supabase_url', 'N/A')}")
            print(f"Intervalo de sondeo: {config.get('polling_interval', 'N/A')} segundos")
            print(f"Nivel de log: {config.get('log_level', 'N/A')}")
            return 0
        
        elif args.mode == 'once':
            # Modo ejecución única
            logger.info("Ejecutando procesamiento único...")
            stats = processor.process_once()
            
            print("\n=== RESULTADOS DEL PROCESAMIENTO ===")
            print(f"Correos procesados: {stats['emails_processed']}")
            print(f"Archivos XML encontrados: {stats['xml_files_found']}")
            print(f"Facturas procesadas: {stats['facturas_processed']}")
            print(f"Facturas insertadas: {stats['facturas_inserted']}")
            print(f"Errores: {stats['errors']}")
            
            if stats['errors'] > 0:
                logger.warning(f"Se encontraron {stats['errors']} errores durante el procesamiento")
                return 1
            else:
                logger.info("Procesamiento completado sin errores")
                return 0
        
        else:
            # Modo continuo (default)
            logger.info("Iniciando procesamiento continuo...")
            logger.info("Presiona Ctrl+C para detener el procesador")
            
            processor.start_processing()
            return 0
    
    except KeyboardInterrupt:
        logger.info("Interrupción del usuario detectada")
        return 0
    except Exception as e:
        logger.error(f"Error en la ejecución principal: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())