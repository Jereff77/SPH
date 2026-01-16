"""
Módulo de conexión a Supabase
"""

from supabase import create_client, Client
from typing import Dict, Any, Optional
from datetime import datetime
from .config import Config
from .logger import logger

class SupabaseClient:
    """Cliente para interactuar con Supabase"""
    
    def __init__(self):
        """Inicializa el cliente de Supabase"""
        try:
            self.client: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
            self.table_name = Config.TABLE_NAME
            logger.info("Cliente de Supabase inicializado correctamente")
        except Exception as e:
            logger.error(f"Error al inicializar cliente de Supabase: {str(e)}")
            raise
    
    def insert_factura(self, factura_data: Dict[str, Any]) -> bool:
        """
        Inserta una factura en la base de datos
        
        Args:
            factura_data: Diccionario con los datos de la factura
            
        Returns:
            bool: True si se insertó correctamente, False en caso contrario
        """
        try:
            # Verificar si ya existe la factura por UUID
            existing_factura = self.get_factura_by_uuid(factura_data.get('uuidCFDI'))
            if existing_factura:
                logger.warning(f"La factura con UUID {factura_data.get('uuidCFDI')} ya existe en la base de datos")
                return False
            
            # Convertir datetime a string para evitar problemas de serialización
            factura_data_copy = {}
            for key, value in factura_data.items():
                if isinstance(value, datetime):
                    factura_data_copy[key] = value.isoformat()
                else:
                    factura_data_copy[key] = value
            
            # Insertar factura
            result = self.client.table(self.table_name).insert(factura_data_copy).execute()
            
            if result.data:
                logger.info(f"Factura insertada correctamente: {factura_data.get('uuidCFDI')}")
                return True
            else:
                logger.error(f"Error al insertar factura: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error al insertar factura en Supabase: {str(e)}")
            return False
    
    def get_factura_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene una factura por su UUID
        
        Args:
            uuid: UUID de la factura
            
        Returns:
            Dict con los datos de la factura o None si no existe
        """
        try:
            result = self.client.table(self.table_name).select("*").eq("uuidCFDI", uuid).execute()
            
            if result.data:
                return result.data[0]
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error al consultar factura por UUID: {str(e)}")
            return None
    
    def test_connection(self) -> bool:
        """
        Prueba la conexión con Supabase
        
        Returns:
            bool: True si la conexión es exitosa, False en caso contrario
        """
        try:
            # Intentar realizar una consulta simple
            result = self.client.table(self.table_name).select("count").execute()
            logger.info("Conexión a Supabase exitosa")
            return True
        except Exception as e:
            logger.error(f"Error en la conexión a Supabase: {str(e)}")
            return False
    
    def get_facturas_count(self) -> int:
        """
        Obtiene el número total de facturas en la base de datos

        Returns:
            int: Número de facturas
        """
        try:
            result = self.client.table(self.table_name).select("count", count="exact").execute()
            return result.count if result.count else 0
        except Exception as e:
            logger.error(f"Error al obtener conteo de facturas: {str(e)}")
            return 0

    def insert_movimiento_bancario(self, movimiento_data: Dict[str, Any]) -> bool:
        """
        Inserta un movimiento bancario en la base de datos

        Args:
            movimiento_data: Diccionario con los datos del movimiento

        Returns:
            bool: True si se insertó correctamente, False en caso contrario
        """
        try:
            # Verificar si ya existe el movimiento por idUnico
            if movimiento_data.get('idUnico'):
                existing = self.get_movimiento_by_idunico(movimiento_data['idUnico'])
                if existing:
                    logger.warning(f"El movimiento con idUnico {movimiento_data['idUnico']} ya existe en la base de datos")
                    return False
            else:
                # Si no tiene idUnico, verificar por rastreo (compatibilidad con versiones anteriores)
                if movimiento_data.get('rastreo'):
                    existing = self.get_movimiento_by_rastreo(movimiento_data['rastreo'])
                    if existing:
                        logger.warning(f"El movimiento con rastreo {movimiento_data['rastreo']} ya existe en la base de datos")
                        return False

            # Convertir datetime a string para evitar problemas de serialización
            movimiento_data_copy = {}
            for key, value in movimiento_data.items():
                if isinstance(value, datetime):
                    movimiento_data_copy[key] = value.isoformat()
                else:
                    movimiento_data_copy[key] = value

            # Insertar movimiento en la tabla movbancarios
            result = self.client.table("movbancarios").insert(movimiento_data_copy).execute()

            if result.data:
                logger.info(f"Movimiento bancario insertado correctamente: idUnico={movimiento_data.get('idUnico')}")
                return True
            else:
                logger.error(f"Error al insertar movimiento bancario: {result}")
                return False

        except Exception as e:
            logger.error(f"Error al insertar movimiento bancario en Supabase: {str(e)}")
            return False

    def get_movimiento_by_rastreo(self, rastreo: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un movimiento bancario por su clave de rastreo

        Args:
            rastreo: Clave de rastreo del movimiento

        Returns:
            Dict con los datos del movimiento o None si no existe
        """
        try:
            result = self.client.table("movbancarios").select("*").eq("rastreo", rastreo).execute()

            if result.data:
                return result.data[0]
            else:
                return None

        except Exception as e:
            logger.error(f"Error al consultar movimiento por rastreo: {str(e)}")
            return None

    def get_movimiento_by_referencia(self, referencia: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un movimiento bancario por su referencia

        Args:
            referencia: Referencia del movimiento

        Returns:
            Dict con los datos del movimiento o None si no existe
        """
        try:
            result = self.client.table("movbancarios").select("*").eq("referencia", referencia).execute()

            if result.data:
                return result.data[0]
            else:
                return None

        except Exception as e:
            logger.error(f"Error al consultar movimiento por referencia: {str(e)}")
            return None

    def get_movimiento_by_idunico(self, idunico: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un movimiento bancario por su idUnico

        Args:
            idUnico: Identificador único del movimiento

        Returns:
            Dict con los datos del movimiento o None si no existe
        """
        try:
            result = self.client.table("movbancarios").select("*").eq("idUnico", idunico).execute()

            if result.data:
                return result.data[0]
            else:
                return None

        except Exception as e:
            logger.error(f"Error al consultar movimiento por idUnico: {str(e)}")
            return None