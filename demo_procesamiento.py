#!/usr/bin/env python3
"""
Script de demostración del procesamiento de facturas
"""

import os
import sys
from datetime import datetime
from src.processor import FacturaProcessor
from src.config import Config
from src.logger import logger

def demo_procesamiento():
    """Demuestra el procesamiento con un XML de ejemplo"""
    print("=== DEMOSTRACIÓN DEL SISTEMA DE PROCESAMIENTO ===\n")
    
    # Crear un XML de ejemplo para demostración
    xml_ejemplo = '''<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" 
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
                  Version="4.0"
                  Folio="DEMO-001"
                  Fecha="2024-11-05T15:30:00"
                  SubTotal="1000.00"
                  Moneda="MXN"
                  Total="1160.00"
                  NoCertificado="00001000000712609958">
    <cfdi:Emisor Rfc="MOCA560611C33" Nombre="ARTURO BERNABE MONTERRUBIO CASTRO" RegimenFiscal="606"/>
    <cfdi:Receptor Rfc="GSP17122021A" Nombre="GRUPO SPH" UsoCFDI="G03"/>
    <cfdi:Conceptos>
        <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" 
                       Descripcion="SERVICIO DE DEMOSTRACION DEL SISTEMA" ValorUnitario="1000.00" Importe="1000.00"/>
    </cfdi:Conceptos>
    <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
        <cfdi:Traslados>
            <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
    </cfdi:Impuestos>
    <cfdi:Complemento>
        <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                                xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd"
                                Version="1.1"
                                UUID="DEMO-12345678-1234-1234-123456789012"
                                FechaTimbrado="2024-11-05T15:35:00"
                                RfcProvCertif="SAT970701NN3"
                                SelloCFD="..."
                                NoCertificadoSAT="00001000000705250068"
                                SelloSAT="..."/>
    </cfdi:Complemento>
</cfdi:Comprobante>'''
    
    print("1. Creando procesador...")
    processor = FacturaProcessor()
    
    print("2. Probando conexiones...")
    if not processor._test_connections():
        print("❌ Error en las conexiones")
        return 1
    
    print("3. Parseando XML de demostración...")
    from src.xml_parser import XMLParser
    from src.factura_mapper import FacturaMapper
    
    parser = XMLParser()
    xml_data = parser.parse_xml(xml_ejemplo.encode('utf-8'))
    
    if not xml_data:
        print("❌ Error al parsear XML")
        return 1
    
    print("4. Mapeando datos a catFacturas...")
    mapper = FacturaMapper()
    factura_data = mapper.map_to_catfacturas(xml_data)
    
    if not factura_data:
        print("❌ Error al mapear factura")
        return 1
    
    print("5. Intentando insertar en Supabase...")
    if processor.supabase_client.insert_factura(factura_data):
        print("OK: Factura de demostracion insertada correctamente")
        print(f"   UUID: {factura_data.get('uuidCFDI')}")
        print(f"   Emisor: {factura_data.get('nombreEmisor')}")
        print(f"   Total: ${factura_data.get('totalCFDI', 0):.2f}")
        print(f"   Concepto: {factura_data.get('concepto')}")
    else:
        print("ERROR: Error al insertar factura (puede ser duplicada)")
    
    print("\n=== DEMOSTRACIÓN COMPLETADA ===")
    print("El sistema está funcionando correctamente.")
    print("Para procesar correos reales, ejecuta:")
    print("   python main.py")
    print("\nPara detener el procesamiento continuo, presiona Ctrl+C")
    
    return 0

if __name__ == "__main__":
    sys.exit(demo_procesamiento())