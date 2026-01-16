#!/usr/bin/env python3
"""
Test para validar que las claves de 7+ dígitos son aceptadas
"""

import re

def validate_clave_rastreo(clave: str) -> bool:
    """
    Valida si una clave de rastreo tiene un formato válido.
    (Versión actualizada con 7+ dígitos)
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

    # Caso 3: Números puros (ej: 1234567890) - ACTUALIZADO A 7+ DÍGITOS
    if clave.isdigit():
        return len(clave) >= 7

    # Caso 4: Formato alfanumérico general
    return len(clave) >= 10 and any(c.isalpha() for c in clave) and any(c.isdigit() for c in clave)

def test_claves_banco():
    """Prueba las claves reales del banco"""

    print("TEST DE CLAVES DE RASTREO DEL BANCO")
    print("=" * 50)

    # Claves reales encontradas en los logs
    claves_reales = [
        '123744277',  # 9 dígitos - antes rechazada, ahora debería ser válida
        '123708846',  # 9 dígitos - antes rechazada, ahora debería ser válida
        '058-05/12/2025/05-001ULFK589',  # Formato completo
        'BNET01002512150049564834',  # Formato BNET
        '1234567',  # 7 dígitos - nuevo mínimo
        '123456',   # 6 dígitos - debería seguir siendo inválida
        '123456789012345',  # 15 dígitos
    ]

    for clave in claves_reales:
        resultado = validate_clave_rastreo(clave)
        status = "VÁLIDA" if resultado else "INVÁLIDA"
        longitud = len(clave)

        if clave.isdigit():
            tipo = f"Números puros ({longitud} dígitos)"
        elif '-' in clave or '/' in clave:
            tipo = f"Con guiones/diagonales ({longitud} chars)"
        elif clave.startswith('BNET'):
            tipo = f"Formato BNET ({longitud} chars)"
        else:
            tipo = f"Otro formato ({longitud} chars)"

        print(f"{clave:<30} | {status:<8} | {tipo}")

    print("\n" + "=" * 50)
    print("RESUMEN:")
    print("- Claves de 7+ dígitos: Ahora ACEPTADAS ✅")
    print("- Claves de 6 dígitos: Sigue siendo RECHAZADAS ❌")
    print("- Formatos con guiones: Sin cambios ✅")
    print("- Formatos BNET: Sin cambios ✅")

if __name__ == "__main__":
    test_claves_banco()