#!/usr/bin/env python3
"""
Test para verificar la lógica de mover correos "otros" a carpeta BanBajio/otros
"""

def test_otros_folder_logic():
    """Test para validar la lógica de mover correos otros"""

    print("TEST LÓGICA DE MOVIMIENTO DE CORREOS 'OTROS'")
    print("=" * 50)

    # Casos de prueba
    test_cases = [
        {
            'subject': 'Instrucción de depósito a tu cuenta',
            'has_xml': False,
            'is_bank': False,
            'is_deposit': True,
            'expected_action': 'Procesar depósito',
            'expected_status': 'Procesado y movido a BanBajio'
        },
        {
            'subject': 'Comprobante fiscal XML',
            'has_xml': True,
            'is_bank': False,
            'is_deposit': False,
            'expected_action': 'Procesar XML',
            'expected_status': 'Procesado y movido a procesados'
        },
        {
            'subject': 'Notificación de transferencia BBVA',
            'has_xml': False,
            'is_bank': True,
            'is_deposit': False,
            'expected_action': 'Procesar banco',
            'expected_status': 'Procesado pero NO leído'
        },
        {
            'subject': 'Promoción del mes',
            'has_xml': False,
            'is_bank': False,
            'is_deposit': False,
            'expected_action': 'Mover a otros',
            'expected_status': 'Movido a BanBajio/otros SIN marcar como leído'
        },
        {
            'subject': 'Newsletter semanal',
            'has_xml': False,
            'is_bank': False,
            'is_deposit': False,
            'expected_action': 'Mover a otros',
            'expected_status': 'Movido a BanBajio/otros SIN marcar como leído'
        },
        {
            'subject': 'Alerta de sistema',
            'has_xml': False,
            'is_bank': False,
            'is_deposit': False,
            'expected_action': 'Mover a otros',
            'expected_status': 'Movido a BanBajio/otros SIN marcar como leído'
        }
    ]

    for i, test_case in enumerate(test_cases, 1):
        subject = test_case['subject']
        has_xml = test_case['has_xml']
        is_bank = test_case['is_bank']
        is_deposit = test_case['is_deposit']

        print(f"\nTest {i}: {subject}")
        print(f"  XML: {has_xml} | Banco: {is_bank} | Depósito: {is_deposit}")

        # Lógica del sistema
        if is_deposit:
            action = "Procesar depósito"
            status = "Procesado y movido a BanBajio"
        elif is_bank:
            action = "Procesar banco"
            status = "Procesado pero NO leído"
        elif has_xml:
            action = "Procesar XML"
            status = "Procesado y movido a procesados"
        else:
            action = "Mover a otros"
            status = "Movido a BanBajio/otros SIN marcar como leído"

        expected_action = test_case['expected_action']
        expected_status = test_case['expected_status']

        # Validar
        action_ok = "✓" if action == expected_action else "✗"
        status_ok = "✓" if status == expected_status else "✗"

        print(f"  Acción:   {action} {action_ok} (esperado: {expected_action})")
        print(f"  Estado:   {status} {status_ok} (esperado: {expected_status})")

        if action != expected_action or status != expected_status:
            print(f"  ❌ ERROR - Lógica incorrecta")
        else:
            print(f"  ✅ Correcto")

    print("\n" + "=" * 50)
    print("RESUMEN:")
    print("- Correos DEPÓSITO: Procesados y archivados en BanBajio")
    print("- Correos FACTURA XML: Procesados y archivados en procesados")
    print("- Correos BANCARIOS: Procesados pero no leídos")
    print("- Correos OTROS: Movidos a BanBajio/otros sin marcar como leído ✅")
    print("\nLa lógica está lista para implementarse en el sistema.")

if __name__ == "__main__":
    test_otros_folder_logic()