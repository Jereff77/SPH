"""
Módulo de configuración del sistema
"""

import os
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

class Config:
    """Clase de configuración del sistema"""

    # Configuración IMAP
    IMAP_SERVER = os.getenv('IMAP_SERVER', 'imap.hostinger.com')
    IMAP_PORT = int(os.getenv('IMAP_PORT', '993'))
    IMAP_USER = os.getenv('IMAP_USER')
    IMAP_PASSWORD = os.getenv('IMAP_PASSWORD')

    # Configuración Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')

    # Configuración del procesador
    POLLING_INTERVAL = int(os.getenv('POLLING_INTERVAL', '60'))
    POLLING_INTERVAL_IDLE = int(os.getenv('POLLING_INTERVAL_IDLE', '300'))  # Intervalo cuando no hay actividad (5 min)
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Configuración de horarios
    SCHEDULE_ENABLED = os.getenv('SCHEDULE_ENABLED', 'true').lower() == 'true'
    SCHEDULE_START_TIME = os.getenv('SCHEDULE_START_TIME', '09:00')  # Formato HH:MM
    SCHEDULE_END_TIME = os.getenv('SCHEDULE_END_TIME', '18:00')      # Formato HH:MM
    SCHEDULE_DAYS = os.getenv('SCHEDULE_DAYS', '1,2,3,4,5')  # 1=Lunes, 7=Domingo
    SCHEDULE_TIMEZONE = os.getenv('SCHEDULE_TIMEZONE', 'America/Mexico_City')

    # Tabla de base de datos
    TABLE_NAME = os.getenv('TABLE_NAME', 'catFacturas')

    @classmethod
    def validate_config(cls):
        """Valida que todas las configuraciones requeridas estén presentes"""
        required_configs = [
            'IMAP_USER', 'IMAP_PASSWORD',
            'SUPABASE_URL', 'SUPABASE_KEY'
        ]

        # Configuraciones opcionales pero recomendadas
        optional_configs = ['TABLE_NAME']

        missing_configs = []
        for config in required_configs:
            if not getattr(cls, config):
                missing_configs.append(config)

        if missing_configs:
            raise ValueError(f"Faltan las siguientes configuraciones requeridas: {', '.join(missing_configs)}")

        # Advertir sobre configuraciones opcionales no definidas
        missing_optional = []
        for config in optional_configs:
            if not getattr(cls, config):
                missing_optional.append(config)

        if missing_optional:
            print(f"ADVERTENCIA: Las siguientes configuraciones opcionales no están definidas, usando valores predeterminados: {', '.join(missing_optional)}")

        return True

    @classmethod
    def is_schedule_active(cls):
        """
        Verifica si el sistema debe estar activo según el horario configurado

        Returns:
            bool: True si está dentro del horario permitido, False en caso contrario
        """
        if not cls.SCHEDULE_ENABLED:
            return True  # Si no hay horario configurado, siempre activo

        try:
            # Obtener día y hora actual
            now = datetime.now()
            current_day = now.isoweekday()  # 1=Lunes, 7=Domingo
            current_time = now.strftime('%H:%M')

            # Verificar si es un día permitido
            allowed_days = [int(d.strip()) for d in cls.SCHEDULE_DAYS.split(',')]
            if current_day not in allowed_days:
                return False

            # Verificar si está dentro del horario permitido
            if cls.SCHEDULE_START_TIME <= current_time <= cls.SCHEDULE_END_TIME:
                return True

            return False

        except Exception as e:
            # Si hay error al verificar horario, permitir ejecución por seguridad
            return True

    @classmethod
    def get_schedule_info(cls):
        """
        Retorna información del horario configurado para logging

        Returns:
            dict: Información del horario
        """
        if not cls.SCHEDULE_ENABLED:
            return {'enabled': False, 'message': 'Sin restricción de horario'}

        day_names = {
            1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
            5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
        }
        allowed_days = [int(d.strip()) for d in cls.SCHEDULE_DAYS.split(',')]
        day_list = [day_names.get(d, str(d)) for d in allowed_days]

        return {
            'enabled': True,
            'start_time': cls.SCHEDULE_START_TIME,
            'end_time': cls.SCHEDULE_END_TIME,
            'days': day_list,
            'timezone': cls.SCHEDULE_TIMEZONE
        }