#!/usr/bin/env python3
"""
Test para validar la corrección de extracción de claves de rastreo
"""

import re

def validate_clave_rastreo(clave: str) -> bool:
    """
    Valida si una clave de rastreo tiene un formato válido.
    (Copia del método implementado en DepositProcessor)
    """
    if not clave:
        return False

    # Eliminar espacios en blanco
    clave = clave.strip()

    # Caso 1: Formato con guiones/diagonales (ej: 058-05/12/2025/05-001ULFK589)
    if '-' in clave or '/' in clave:
        return len(clave) >= 15 and any(c.isalnum() for c in clave)

    # Caso 2: Formato BNET (ej: BNET01002512150049564834)
    if clave.startswith('BNET'):
        return len(clave) >= 20

    # Caso 3: Números puros (ej: 1234567890)
    if clave.isdigit():
        return len(clave) >= 10

    # Caso 4: Formato alfanumérico general
    return len(clave) >= 10 and any(c.isalpha() for c in clave) and any(c.isdigit() for c in clave)

def test_clave_rastreo_validation():
    """Prueba el método de validación de claves de rastreo"""

    # Casos de prueba reales de los logs
    test_cases = [
        # Claves que deberían ser válidas
        {'clave': '058-05/12/2025/05-001ULFK589', 'valid': True, 'description': 'Clave larga con guiones y diagonales'},
        {'clave': 'BNET01002512150049564834', 'valid': True, 'description': 'Clave BNET'},
        {'clave': '1234567890', 'valid': True, 'description': 'Números puros 10 dígitos'},
        {'clave': '123456789012345', 'valid': True, 'description': 'Números puros largos'},

        # Claves que deberían ser inválidas
        {'clave': '123744277', 'valid': False, 'description': 'Números cortos (9 dígitos)'},
        {'clave': '123708846', 'valid': False, 'description': 'Números cortos (9 dígitos)'},
        {'clave': '058', 'valid': False, 'description': 'Número muy corto'},
        {'clave': 'ABC', 'valid': False, 'description': 'Texto muy corto'},
        {'clave': '', 'valid': False, 'description': 'Vacío'},
    ]

    print("TEST DE VALIDACIÓN DE CLAVES DE RASTREO")
    print("=" * 50)

    exitosos = 0
    total = len(test_cases)

    for test_case in test_cases:
        clave = test_case['clave']
        esperado = test_case['valid']
        description = test_case['description']

        resultado = validate_clave_rastreo(clave)
        status = "OK" if resultado == esperado else "ERROR"

        if resultado == esperado:
            exitosos += 1

        print(f"{status} | {clave:<30} | Esperado: {esperado:<5} | Real: {resultado:<5} | {description}")

    print("\n" + "=" * 50)
    print(f"RESULTADO: {exitosos}/{total} pruebas exitosas")

    if exitosos == total:
        print("TODAS LAS PRUEBAS PASARON - Las correcciones funcionan correctamente")
    else:
        print("ALGUNAS PRUEBAS FALLARON - Requiere más ajustes")

    return exitosos == total

def test_extraction_patterns():
    """Prueba los patrones de extracción con texto real"""

    import re

    # Textos reales extraídos de los logs
    test_cases = [
        {
            'description': 'Caso 1: Clave corta inválida',
            'body': 'Clave de Rastreo: 123744277',
            'expected_clave': None
        },
        {
            'description': 'Caso 2: Clave corta inválida',
            'body': 'Clave de Rastreo: 123708846',
            'expected_clave': None
        },
        {
            'description': 'Caso 3: Clave completa con guiones',
            'body': 'Clave de Rastreo: 058-05/12/2025/05-001ULFK589',
            'expected_clave': '058-05/12/2025/05-001ULFK589'
        },
        {
            'description': 'Caso 4: Clave BNET',
            'body': 'Clave de Rastreo:\tBNET01002512150049564834',
            'expected_clave': 'BNET01002512150049564834'
        }
    ]

    # Patrones actualizados del sistema
    rastreo_patterns = [
        r'Clave de Rastreo:\t+([A-Z0-9\-\/\.]+)',  # Tabulaciones - incluye guiones, diagonales, puntos
        r'Clave de Rastreo:\s+([A-Z0-9\-\/\.]+)',  # Espacios múltiples - incluye caracteres especiales
        r'Clave de Rastreo:\s*([A-Z0-9\-\/\.]+)',  # Espacio simple - incluye caracteres especiales
        r'Clave de Rastreo:([A-Z0-9\-\/\.]+)',     # Directo - incluye caracteres especiales
        r'(BNET[A-Z0-9]+)',                         # Patrón específico BNET
        r'\b([A-Z]{4}\d{20,30})\b',               # Formato general
        r'\b(\d{10,})\b',                          # Números de 10+ dígitos
    ]

    print("\n\nTEST DE PATRONES DE EXTRACCIÓN")
    print("=" * 50)

    # Sin necesidad de processor para el test
    exitosos = 0
    total = len(test_cases)

    for test_case in test_cases:
        print(f"\n{test_case['description']}:")
        print(f"Texto: '{test_case['body']}'")

        clave_encontrada = None
        for i, pattern in enumerate(rastreo_patterns, 1):
            match = re.search(pattern, test_case['body'], re.IGNORECASE)
            if match:
                rastreo_value = match.group(1).strip()
                if validate_clave_rastreo(rastreo_value):
                    clave_encontrada = rastreo_value
                    print(f"   Patrón {i}: '{rastreo_value}' OK")
                    break
                else:
                    print(f"   Patrón {i}: '{rastreo_value}' ERROR (inválida)")

        esperado = test_case['expected_clave']
        if clave_encontrada == esperado:
            print(f"   Resultado: CORRECTO")
            exitosos += 1
        else:
            print(f"   Resultado: ERROR - Esperado: {esperado}, Encontrado: {clave_encontrada}")

    print("\n" + "=" * 50)
    print(f"RESULTADO EXTRACCIÓN: {exitosos}/{total} pruebas exitosas")

    return exitosos == total

if __name__ == "__main__":
    # Ejecutar todas las pruebas
    validation_ok = test_clave_rastreo_validation()
    extraction_ok = test_extraction_patterns()

    print("\n" + "=" * 50)
    print("RESUMEN FINAL")
    print("=" * 50)

    if validation_ok and extraction_ok:
        print("TODAS LAS PRUEBAS PASARON")
        print("El sistema está listo para procesar los correos nuevamente")
    else:
        print("ALGUNAS PRUEBAS FALLARON")
        print("Se requieren más ajustes antes de procesar correos reales")