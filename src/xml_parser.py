"""
Módulo para parseo de archivos XML de facturas CFDI
"""

import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from datetime import datetime
import re
from .logger import logger

class XMLParser:
    """Parser para archivos XML de facturas CFDI"""
    
    # Namespaces comunes en CFDI
    NAMESPACES = {
        'cfdi': 'http://www.sat.gob.mx/cfd/4',
        'tfd': 'http://www.sat.gob.mx/TimbreFiscalDigital',
        'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    }
    
    def __init__(self):
        """Inicializa el parser de XML"""
        pass
    
    def parse_xml(self, xml_content: bytes) -> Optional[Dict[str, Any]]:
        """
        Parsea el contenido de un archivo XML de factura
        
        Args:
            xml_content: Contenido del archivo XML en bytes
            
        Returns:
            Dict con los datos extraídos o None si hay error
        """
        try:
            # Decodificar el contenido XML
            xml_str = xml_content.decode('utf-8')
            
            # Parsear el XML
            root = ET.fromstring(xml_str)
            
            # Extraer datos del comprobante
            comprobante_data = self._extract_comprobante_data(root)
            
            # Extraer datos del emisor
            emisor_data = self._extract_emisor_data(root)
            
            # Extraer datos del receptor
            receptor_data = self._extract_receptor_data(root)
            
            # Extraer conceptos
            conceptos_data = self._extract_conceptos_data(root)
            
            # Extraer timbre fiscal
            timbre_data = self._extract_timbre_data(root)
            
            # Extraer impuestos
            impuestos_data = self._extract_impuestos_data(root)
            
            # Combinar todos los datos
            factura_data = {
                **comprobante_data,
                **emisor_data,
                **receptor_data,
                **conceptos_data,
                **timbre_data,
                **impuestos_data
            }
            
            logger.info(f"XML parseado correctamente - UUID: {factura_data.get('uuidCFDI', 'N/A')}")
            return factura_data
            
        except ET.ParseError as e:
            logger.error(f"Error al parsear XML: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error inesperado al parsear XML: {str(e)}")
            return None
    
    def _extract_comprobante_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos del comprobante principal"""
        data = {}
        
        try:
            # Datos básicos del comprobante
            data['folioCFDI'] = root.get('Folio', '')
            data['fecCFDI'] = self._parse_date(root.get('Fecha'))
            data['totalCFDI'] = self._parse_float(root.get('Total', '0'))
            data['subtotalCFDI'] = self._parse_float(root.get('SubTotal', '0'))
            data['moneda'] = root.get('Moneda', 'MXN')
            
            # Extraer mes y año de la fecha
            if data['fecCFDI']:
                data['mesFactura'] = data['fecCFDI'].month
                data['anioCFDI'] = data['fecCFDI'].year
            else:
                data['mesFactura'] = datetime.now().month
                data['anioCFDI'] = datetime.now().year
            
            # No. Certificado
            data['noCertificadoSAT'] = root.get('NoCertificado', '')
            
        except Exception as e:
            logger.error(f"Error al extraer datos del comprobante: {str(e)}")
        
        return data
    
    def _extract_emisor_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos del emisor"""
        data = {}
        
        try:
            emisor = root.find('cfdi:Emisor', self.NAMESPACES)
            if emisor is not None:
                data['rfcEmisor'] = emisor.get('Rfc', '')
                data['nombreEmisor'] = emisor.get('Nombre', '')
                data['regimenFiscal'] = self._parse_int(emisor.get('RegimenFiscal', '0'))
            
        except Exception as e:
            logger.error(f"Error al extraer datos del emisor: {str(e)}")
        
        return data
    
    def _extract_receptor_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos del receptor"""
        data = {}
        
        try:
            receptor = root.find('cfdi:Receptor', self.NAMESPACES)
            if receptor is not None:
                # Guardar datos del receptor para referencia (no se usan en la tabla)
                data['receptorRFC'] = receptor.get('Rfc', '')
                data['receptorNombre'] = receptor.get('Nombre', '')
            
        except Exception as e:
            logger.error(f"Error al extraer datos del receptor: {str(e)}")
        
        return data
    
    def _extract_conceptos_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos de los conceptos"""
        data = {}
        
        try:
            conceptos = root.find('cfdi:Conceptos', self.NAMESPACES)
            if conceptos is not None:
                conceptos_list = []
                concepto_principal = ""
                
                for concepto in conceptos.findall('cfdi:Concepto', self.NAMESPACES):
                    descripcion = concepto.get('Descripcion', '')
                    cantidad = concepto.get('Cantidad', '1')
                    valor_unitario = concepto.get('ValorUnitario', '0')
                    importe = concepto.get('Importe', '0')
                    
                    conceptos_list.append({
                        'descripcion': descripcion,
                        'cantidad': cantidad,
                        'valor_unitario': valor_unitario,
                        'importe': importe
                    })
                    
                    # Usar el primer concepto como concepto principal
                    if not concepto_principal:
                        concepto_principal = descripcion
                
                data['concepto'] = concepto_principal
                data['conceptos_detalle'] = conceptos_list
            
        except Exception as e:
            logger.error(f"Error al extraer datos de conceptos: {str(e)}")
        
        return data
    
    def _extract_timbre_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos del timbre fiscal digital"""
        data = {}
        
        try:
            # Buscar el timbre fiscal en diferentes ubicaciones posibles
            timbre = None
            
            # Buscar en complementos
            complementos = root.find('cfdi:Complementos', self.NAMESPACES)
            if complementos is not None:
                timbre = complementos.find('.//tfd:TimbreFiscalDigital', self.NAMESPACES)
            
            # Si no se encuentra, buscar en cualquier lugar
            if timbre is None:
                timbre = root.find('.//tfd:TimbreFiscalDigital', self.NAMESPACES)
            
            if timbre is not None:
                data['uuidCFDI'] = timbre.get('UUID', '')
                data['selloSAT'] = timbre.get('SelloSAT', '')
                data['idFactura'] = timbre.get('UUID', '')  # Usar UUID como idFactura
                data['fum'] = self._parse_date(timbre.get('FechaTimbrado'))
            
        except Exception as e:
            logger.error(f"Error al extraer datos del timbre: {str(e)}")
        
        return data
    
    def _extract_impuestos_data(self, root: ET.Element) -> Dict[str, Any]:
        """Extrae datos de los impuestos"""
        data = {}
        
        try:
            impuestos = root.find('cfdi:Impuestos', self.NAMESPACES)
            if impuestos is not None:
                # Extraer totales de impuestos
                total_traslados = impuestos.get('TotalTraslados', '0')
                total_retenciones = impuestos.get('TotalRetenciones', '0')
                
                data['totalTraslados'] = self._parse_float(total_traslados)
                data['totalRetenciones'] = self._parse_float(total_retenciones)
            
        except Exception as e:
            logger.error(f"Error al extraer datos de impuestos: {str(e)}")
        
        return data
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parsea una fecha en formato ISO 8601"""
        if not date_str:
            return None
        
        try:
            # Formatos comunes de fecha en CFDI
            formats = [
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%dT%H:%M:%S.%f',
                '%Y-%m-%d'
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            return None
            
        except Exception:
            return None
    
    def _parse_float(self, value_str: str) -> float:
        """Parsea un valor a float"""
        try:
            if not value_str:
                return 0.0
            return float(value_str.replace(',', ''))
        except (ValueError, AttributeError):
            return 0.0
    
    def _parse_int(self, value_str: str) -> int:
        """Parsea un valor a int"""
        try:
            if not value_str:
                return 0
            return int(value_str)
        except (ValueError, AttributeError):
            return 0
    
    def generate_descripcion(self, factura_data: Dict[str, Any]) -> str:
        """
        Genera una descripción formateada de la factura
        
        Args:
            factura_data: Datos de la factura
            
        Returns:
            str: Descripción formateada
        """
        try:
            descripcion = "# Datos del CFDI\n"
            descripcion += f"## EMISOR\n"
            descripcion += f"- **Nombre:** {factura_data.get('nombreEmisor', 'N/A')}\n"
            descripcion += f"- **RFC:** {factura_data.get('rfcEmisor', 'N/A')}\n"
            descripcion += f"- **Régimen Fiscal:** {factura_data.get('regimenFiscal', 'N/A')}\n\n"
            
            descripcion += f"## DATOS GENERALES DEL CFDI\n"
            descripcion += f"- **Folio:** {factura_data.get('folioCFDI', 'N/A')}\n"
            descripcion += f"- **Fecha de Emisión:** {factura_data.get('fecCFDI', 'N/A')}\n"
            descripcion += f"- **UUID:** {factura_data.get('uuidCFDI', 'N/A')}\n"
            descripcion += f"- **Moneda:** {factura_data.get('moneda', 'N/A')}\n\n"
            
            descripcion += f"## TOTALES\n"
            descripcion += f"- **Subtotal:** {factura_data.get('subtotalCFDI', 0):.2f}\n"
            descripcion += f"- **Total:** {factura_data.get('totalCFDI', 0):.2f}\n"
            
            return descripcion
            
        except Exception as e:
            logger.error(f"Error al generar descripción: {str(e)}")
            return "Error al generar descripción"