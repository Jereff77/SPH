#!/usr/bin/env python3
"""
Test para patrones precisos de extracción - evitar capturar texto extra
"""

import re

def test_precise_patterns():
    """Prueba patrones precisos que evitan capturar texto adicional"""

    # Simular el texto del correo con HTML limpio (todo en una línea)
    email_text = """
    Transferencia Interbancaria SPEI
    Fecha de Operacion: 12-Dic-2025
    Hora de Operacion: 11:11:24 horas
    Cuenta Destino: ********8480-CUENTA CONECTA BANBAJIO-1 Nombre del Ordenante: PLANTAS MEDICINALES ANAHUACSA DE CV Banco Emisor: BBVA MEXICO Importe: $ 54,871.04 MN Concepto de Pago: GRUPO SPH 9532 Clave de Rastreo: BNET01002512150049564834 Ubícanos: Banco del Bajío, S.A., Institución de Banca Múltiple. RFC: BBA940707IE1
    """

    print("TEST PATRONES PRECISOS DE EXTRACCIÓN")
    print("=" * 50)

    # Test para Banco Emisor - el campo problemático
    print("\n1. Test Banco Emisor:")
    banco_patterns = [
        r'Banco Emisor:\t+([^\n\r\t]*?)\s*Importe:',  # Tabulaciones - todo antes de Importe
        r'Banco Emisor:\s+([^\n\r]*?)\s*Importe:',    # Espacios - todo antes de Importe
        r'Banco Emisor:\s*([^\n\r]*?)\s*Importe:',    # Espacio simple - todo antes de Importe
        r'Banco Emisor:([^\n\r]*?)\s*Importe:',       # Directo - todo antes de Importe
    ]

    for i, pattern in enumerate(banco_patterns, 1):
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            result = match.group(1).strip()
            print(f"   Patrón {i}: '{result}' - OK" if result == "BBVA MEXICO" else f"   Patrón {i}: '{result}' - ERROR")
        else:
            print(f"   Patrón {i}: No coincide")

    # Test para otros campos
    print("\n2. Test Concepto de Pago:")
    concepto_patterns = [
        r'Concepto de Pago:\t+([^\n\r\t]*?)\s*Clave',  # Tabulaciones - todo antes de Clave
        r'Concepto de Pago:\s+([^\n\r]*?)\s*Clave',    # Espacios - todo antes de Clave
        r'Concepto de Pago:\s*([^\n\r]*?)\s*Clave',    # Espacio simple - todo antes de Clave
        r'Concepto de Pago:([^\n\r]*?)\s*Clave',       # Directo - todo antes de Clave
    ]

    for i, pattern in enumerate(concepto_patterns, 1):
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            result = match.group(1).strip()
            print(f"   Patrón {i}: '{result}' - OK" if result == "GRUPO SPH 9532" else f"   Patrón {i}: '{result}' - ERROR")
        else:
            print(f"   Patrón {i}: No coincide")

    print("\n3. Test Clave de Rastreo:")
    rastreo_patterns = [
        r'Clave de Rastreo:\t+([A-Z0-9]+)',
        r'Clave de Rastreo:\s+([A-Z0-9]+)',
        r'Clave de Rastreo:\s*([A-Z0-9]+)',
        r'(BNET[A-Z0-9]+)',
    ]

    for i, pattern in enumerate(rastreo_patterns, 1):
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            result = match.group(1).strip()
            expected = "BNET01002512150049564834"
            print(f"   Patrón {i}: '{result}' - OK" if result == expected else f"   Patrón {i}: '{result}' - ERROR")
        else:
            print(f"   Patrón {i}: No coincide")

    print("\n" + "=" * 50)
    print("RESULTADO ESPERADO:")
    print("- Banco Emisor: BBVA MEXICO")
    print("- Concepto: GRUPO SPH 9532")
    print("- Clave de Rastreo: BNET01002512150049564834")
    print("\nLos patrones deben capturar SOLO los datos del campo, sin texto adicional.")

if __name__ == "__main__":
    test_precise_patterns()