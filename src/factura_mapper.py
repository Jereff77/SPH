"""
Módulo para mapear datos del XML a la estructura de la tabla catFacturas
"""

from typing import Dict, Any, Optional
from datetime import datetime
from .logger import logger

class FacturaMapper:
    """Clase para mapear datos XML a la estructura de catFacturas"""
    
    def __init__(self):
        """Inicializa el mapper"""
        pass
    
    def map_to_catfacturas(self, xml_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Mapea los datos extraídos del XML a la estructura de la tabla catFacturas
        
        Args:
            xml_data: Diccionario con los datos extraídos del XML
            
        Returns:
            Dict con los datos mapeados para la tabla catFacturas o None si hay error
        """
        try:
            # Validar datos mínimos requeridos
            if not self._validate_required_fields(xml_data):
                logger.error("Faltan campos requeridos en los datos del XML")
                return None
            
            # Mapear campos según la estructura de catFacturas
            factura_mapped = {
                # Campos obligatorios
                "idFactura": xml_data.get("idFactura", ""),
                "uuidCFDI": xml_data.get("uuidCFDI", ""),
                "status": True,  # Siempre activo al insertar
                "fc": datetime.now(),  # Fecha de creación actual
                "aplicada": False,  # No aplicada por defecto
                "manual": False,  # No es manual, es automática
                
                # Campos del XML
                "folioCFDI": xml_data.get("folioCFDI", ""),
                "fecCFDI": xml_data.get("fecCFDI"),
                "totalCFDI": xml_data.get("totalCFDI", 0.0),
                "subtotalCFDI": xml_data.get("subtotalCFDI", 0.0),
                "moneda": xml_data.get("moneda", "MXN"),
                "rfcEmisor": xml_data.get("rfcEmisor", ""),
                "nombreEmisor": xml_data.get("nombreEmisor", ""),
                "regimenFiscal": xml_data.get("regimenFiscal"),
                "selloSAT": xml_data.get("selloSAT", ""),
                "noCertificadoSAT": xml_data.get("noCertificadoSAT", ""),
                
                # Campos derivados
                "mesFactura": xml_data.get("mesFactura", datetime.now().month),
                "anioCFDI": xml_data.get("anioCFDI", datetime.now().year),
                "concepto": self._clean_concepto(xml_data.get("concepto", "")),
                "descripcion": self._generate_descripcion(xml_data),
                
                # Campos con valores por defecto
                "descripcion": xml_data.get("descripcion", ""),
                "idInversionista": None,
                "nomDescriptivo": None,
                "idRGdet": None,
                "uidr": None,
                "fum": xml_data.get("fum"),
                "anio": datetime.now().year,
                "idRAdet": None,
            }
            
            # Limpiar y validar datos
            factura_mapped = self._clean_and_validate_data(factura_mapped)
            
            logger.info(f"Factura mapeada correctamente - UUID: {factura_mapped.get('uuidCFDI')}")
            return factura_mapped
            
        except Exception as e:
            logger.error(f"Error al mapear factura: {str(e)}")
            return None
    
    def _validate_required_fields(self, xml_data: Dict[str, Any]) -> bool:
        """
        Valida que los campos requeridos estén presentes
        
        Args:
            xml_data: Datos del XML
            
        Returns:
            bool: True si los campos requeridos están presentes
        """
        required_fields = ["idFactura", "uuidCFDI"]
        
        for field in required_fields:
            if not xml_data.get(field):
                logger.error(f"Campo requerido faltante: {field}")
                return False
        
        return True
    
    def _clean_and_validate_data(self, factura_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Limpia y valida los datos antes de insertarlos
        
        Args:
            factura_data: Datos de la factura
            
        Returns:
            Dict con los datos limpios y validados
        """
        try:
            # Limpiar campos de texto
            text_fields = [
                "folioCFDI", "rfcEmisor", "nombreEmisor", 
                "concepto", "selloSAT", "noCertificadoSAT"
            ]
            
            for field in text_fields:
                if factura_data.get(field):
                    factura_data[field] = str(factura_data[field]).strip()
            
            # Validar campos numéricos
            numeric_fields = ["totalCFDI", "subtotalCFDI", "regimenFiscal"]
            
            for field in numeric_fields:
                if factura_data.get(field) is None:
                    if field in ["totalCFDI", "subtotalCFDI"]:
                        factura_data[field] = 0.0
                    elif field == "regimenFiscal":
                        factura_data[field] = 0
            
            # Validar campos de fecha
            date_fields = ["fecCFDI", "fum"]
            
            for field in date_fields:
                if factura_data.get(field) is None:
                    if field == "fecCFDI":
                        factura_data[field] = datetime.now()
                    elif field == "fum":
                        factura_data[field] = None
            
            # Validar mes y año
            if factura_data.get("mesFactura") is None:
                factura_data["mesFactura"] = datetime.now().month
            
            if factura_data.get("anioCFDI") is None:
                factura_data["anioCFDI"] = datetime.now().year
            
            # Asegurar que el concepto no esté vacío
            if not factura_data.get("concepto"):
                factura_data["concepto"] = "Sin descripción"
            
            # Generar descripción si está vacía
            if not factura_data.get("descripcion"):
                factura_data["descripcion"] = self._generate_basic_descripcion(factura_data)
            
            return factura_data
            
        except Exception as e:
            logger.error(f"Error al limpiar y validar datos: {str(e)}")
            return factura_data
    
    def _clean_concepto(self, concepto: str) -> str:
        """
        Limpia el campo concepto para que cumpla con los requisitos
        
        Args:
            concepto: Texto del concepto
            
        Returns:
            str: Concepto limpio
        """
        if not concepto:
            return "Sin descripción"
        
        # Limitar longitud si es muy largo
        if len(concepto) > 500:
            concepto = concepto[:497] + "..."
        
        # Reemplazar caracteres problemáticos
        concepto = concepto.replace('"', "'")
        concepto = concepto.replace('\n', ' ')
        concepto = concepto.replace('\r', ' ')
        
        # Eliminar espacios múltiples
        while '  ' in concepto:
            concepto = concepto.replace('  ', ' ')
        
        return concepto.strip()
    
    def _generate_descripcion(self, xml_data: Dict[str, Any]) -> str:
        """
        Genera una descripción detallada de la factura
        
        Args:
            xml_data: Datos del XML
            
        Returns:
            str: Descripción formateada
        """
        try:
            descripcion = "# Datos del CFDI\n"
            descripcion += "## EMISOR\n"
            descripcion += f"- **Nombre:** {xml_data.get('nombreEmisor', 'N/A')}\n"
            descripcion += f"- **RFC:** {xml_data.get('rfcEmisor', 'N/A')}\n"
            descripcion += f"- **Régimen Fiscal:** {xml_data.get('regimenFiscal', 'N/A')}\n\n"
            
            # Agregar datos del receptor si están disponibles
            if xml_data.get('receptorNombre'):
                descripcion += "## RECEPTOR\n"
                descripcion += f"- **Nombre:** {xml_data.get('receptorNombre', 'N/A')}\n"
                descripcion += f"- **RFC:** {xml_data.get('receptorRFC', 'N/A')}\n\n"
            
            descripcion += "## DATOS GENERALES DEL CFDI\n"
            descripcion += f"- **Folio:** {xml_data.get('folioCFDI', 'N/A')}\n"
            
            # Formatear fecha
            fec_cfdi = xml_data.get('fecCFDI')
            if fec_cfdi:
                if isinstance(fec_cfdi, datetime):
                    descripcion += f"- **Fecha de Emisión:** {fec_cfdi.strftime('%Y-%m-%d %H:%M:%S')}\n"
                else:
                    descripcion += f"- **Fecha de Emisión:** {fec_cfdi}\n"
            else:
                descripcion += "- **Fecha de Emisión:** N/A\n"
            
            descripcion += f"- **UUID:** {xml_data.get('uuidCFDI', 'N/A')}\n"
            descripcion += f"- **Moneda:** {xml_data.get('moneda', 'N/A')}\n\n"
            
            # Agregar conceptos si están disponibles
            conceptos_detalle = xml_data.get('conceptos_detalle', [])
            if conceptos_detalle:
                descripcion += "## CONCEPTOS\n"
                descripcion += "| **Cantidad** | **Descripción** | **Valor Unitario** | **Importe** |\n"
                descripcion += "|--------------|-----------------|-------------------|-------------|\n"
                
                for concepto in conceptos_detalle[:5]:  # Limitar a 5 conceptos
                    descripcion += f"| {concepto.get('cantidad', 'N/A')} | {concepto.get('descripcion', 'N/A')} | {concepto.get('valor_unitario', 'N/A')} | {concepto.get('importe', 'N/A')} |\n"
                
                if len(conceptos_detalle) > 5:
                    descripcion += f"| ... | ... | ... | ... | (+{len(conceptos_detalle) - 5} más) |\n"
                
                descripcion += "\n"
            
            descripcion += "## TOTALES\n"
            descripcion += f"- **Subtotal:** {xml_data.get('subtotalCFDI', 0):.2f}\n"
            
            # Agregar impuestos si están disponibles
            total_traslados = xml_data.get('totalTraslados', 0)
            total_retenciones = xml_data.get('totalRetenciones', 0)
            
            if total_traslados > 0:
                descripcion += f"- **IVA Traslados:** {total_traslados:.2f}\n"
            
            if total_retenciones > 0:
                descripcion += f"- **Retenciones:** {total_retenciones:.2f}\n"
            
            descripcion += f"- **Total:** {xml_data.get('totalCFDI', 0):.2f}\n"
            
            return descripcion
            
        except Exception as e:
            logger.error(f"Error al generar descripción: {str(e)}")
            return self._generate_basic_descripcion(xml_data)
    
    def _generate_basic_descripcion(self, factura_data: Dict[str, Any]) -> str:
        """
        Genera una descripción básica cuando hay errores
        
        Args:
            factura_data: Datos de la factura
            
        Returns:
            str: Descripción básica
        """
        try:
            descripcion = f"Factura UUID: {factura_data.get('uuidCFDI', 'N/A')}\n"
            descripcion += f"Emisor: {factura_data.get('nombreEmisor', 'N/A')} ({factura_data.get('rfcEmisor', 'N/A')})\n"
            descripcion += f"Total: ${factura_data.get('totalCFDI', 0):.2f} {factura_data.get('moneda', 'MXN')}\n"
            descripcion += f"Concepto: {factura_data.get('concepto', 'N/A')}"
            
            return descripcion
            
        except Exception as e:
            logger.error(f"Error al generar descripción básica: {str(e)}")
            return "Error al generar descripción"