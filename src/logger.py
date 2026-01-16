"""
Módulo de logging del sistema
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

class Logger:
    """Clase para manejo de logs del sistema"""
    
    def __init__(self, name="facturas_processor", log_level="INFO"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, log_level.upper()))
        
        # Evitar duplicación de handlers
        if not self.logger.handlers:
            self._setup_handlers()
    
    def _setup_handlers(self):
        """Configura los handlers de logging"""
        # Crear directorio de logs si no existe
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        # Handler para consola
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # Handler para archivo
        log_file = log_dir / f"facturas_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        
        # Agregar handlers
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
    
    def debug(self, message):
        """Registra mensaje de debug"""
        self.logger.debug(message)
    
    def info(self, message):
        """Registra mensaje informativo"""
        self.logger.info(message)
    
    def warning(self, message):
        """Registra advertencia"""
        self.logger.warning(message)
    
    def error(self, message):
        """Registra error"""
        self.logger.error(message)
    
    def critical(self, message):
        """Registra error crítico"""
        self.logger.critical(message)
    
    def exception(self, message):
        """Registra excepción con traceback"""
        self.logger.exception(message)

# Instancia global del logger
logger = Logger()