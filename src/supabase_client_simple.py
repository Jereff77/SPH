"""
Módulo de conexión a Supabase (versión simplificada)
"""

from typing import Dict, Any, Optional
from supabase import create_client
from .config import Config
from .logger import logger

class SupabaseClientSimple:
    """Cliente simplificado para interactuar con Supabase"""
    
    def __init__(self):
        """Inicializa el cliente de Supabase"""
        try:
            self.client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
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
            
            # Insertar factura
            result = self.client.table(self.table_name).insert(factura_data).execute()
            
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
            result = self.client.table(self.table_name).select("count", count="exact").execute()
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