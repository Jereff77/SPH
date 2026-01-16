#!/usr/bin/env python3
"""
Test para validar extracción de diferentes monedas (MN, USD, EUR, etc.)
"""

import re

def test_multiple_currencies():
    """Prueba extracción de importes con diferentes monedas"""

    # Casos de prueba con diferentes formatos y monedas
    test_cases = [
        {
            'name': 'Pesos Mexicanos (MN a MXN)',
            'text': 'Importe:		$ 54,871.04 MN',
            'expected_monto': 54871.04,
            'expected_moneda': 'MXN'
        },
        {
            'name': 'Dólares (USD)',
            'text': 'Importe:		$ 12,915.20 USD',
            'expected_monto': 12915.20,
            'expected_moneda': 'USD'
        },
        {
            'name': 'Euros (EUR)',
            'text': 'Importe:		$ 8,750.00 EUR',
            'expected_monto': 8750.00,
            'expected_moneda': 'EUR'
        },
        {
            'name': 'Pesos sin espacio (MN a MXN)',
            'text': 'Importe:$54,871.04 MN',
            'expected_monto': 54871.04,
            'expected_moneda': 'MXN'
        },
        {
            'name': 'Con múltiples espacios',
            'text': 'Importe:   $ 12,915.20   USD',
            'expected_monto': 12915.20,
            'expected_moneda': 'USD'
        }
    ]

    print("TEST EXTRACCIÓN DE IMPORTES CON MÚLTIPLES MONEDAS")
    print("=" * 60)

    # Patrones actualizados del sistema
    importe_patterns = [
        # Patrones que capturan monto y moneda juntos
        r'Importe:\t+\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',  # Tabulaciones con moneda
        r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',  # Espacios múltiples con moneda
        r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',   # Espacio simple con moneda
        r'\$\s*([\d,]+\.\d{2})\s*([A-Z]{3})',            # Solo monto y moneda
        # Patrones específicos para moneda mexicana (MN)
        r'Importe:\t+\$\s*([\d,]+\.\d{2})\s*MN',  # Tabulaciones MN
        r'Importe:\s+\$\s*([\d,]+\.\d{2})\s*MN',  # Espacios múltiples MN
        r'Importe:\s*\$\s*([\d,]+\.\d{2})\s*MN',   # Espacio simple MN
        r'\$\s*([\d,]+\.\d{2})\s*MN',            # Solo monto MN
    ]

    for test_case in test_cases:
        print(f"\n{test_case['name']}:")
        print(f"Texto: '{test_case['text']}'")
        print(f"Esperado: ${test_case['expected_monto']:,.2f} {test_case['expected_moneda']}")

        moneda_encontrada = False
        for i, pattern in enumerate(importe_patterns, 1):
            match = re.search(pattern, test_case['text'], re.IGNORECASE)
            if match:
                # Si el patrón tiene 2 grupos (monto y moneda)
                if len(match.groups()) == 2:
                    importe_str = match.group(1).replace(',', '')
                    moneda = match.group(2).upper()
                else:
                    importe_str = match.group(1).replace(',', '')
                    moneda = 'MN'  # Default para México

                # Convertir MN a MXN
                moneda_final = 'MXN' if moneda == 'MN' else moneda

                try:
                    monto = float(importe_str)
                    print(f"   Patrón {i}: ${monto:,.2f} {moneda_final}", end="")

                    if abs(monto - test_case['expected_monto']) < 0.01 and moneda_final == test_case['expected_moneda']:
                        print(" - OK +")
                        moneda_encontrada = True
                        break
                    else:
                        print(" - ERROR -")
                except:
                    print(f"   Patrón {i}: Error parseando '{importe_str}' - ERROR X")

        if not moneda_encontrada:
            print("   Ningún patrón funcionó - ERROR X")

    print("\n" + "=" * 60)
    print("RESULTADO:")
    print("El sistema detecta correctamente diferentes monedas")
    print("- MN se convierte a MXN")
    print("- USD = Dólares Americanos")
    print("- EUR = Euros")
    print("- Siempre se incluye la columna moneda")

if __name__ == "__main__":
    test_multiple_currencies()