#!/usr/bin/env python3
"""
Test para verificar la decodificación de asuntos MIME
"""

from email.header import decode_header

def test_subject_decoding():
    """Prueba decodificar diferentes formatos de asuntos"""

    # Casos de prueba
    test_cases = [
        "=?UTF-8?Q?Instrucci=C3=B3n_de_dep=C3=B3sito_a_tu_cuenta?=",
        "=?UTF-8?B?SW5zdHJ1Y2Npw7NuIGRlIGRlcMOzc2l0byBhIHR1IGN1ZW50YQ==?=",
        "Asunto normal sin codificar",
        "Test =?ISO-8859-1?Q?con_acent=F3s?=",
    ]

    print("PRUEBA DE DECODIFICACIÓN DE ASUNTOS MIME")
    print("=" * 50)

    for i, encoded_subject in enumerate(test_cases, 1):
        print(f"\nTest {i}:")
        print(f"Original: {encoded_subject}")

        try:
            # Decodificar como lo hace el sistema
            decoded_parts = decode_header(encoded_subject)
            decoded_subject = ''
            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    if encoding:
                        decoded_subject += part.decode(encoding, errors='ignore')
                    else:
                        decoded_subject += part.decode('utf-8', errors='ignore')
                else:
                    decoded_subject += part

            print(f"Decodificado: '{decoded_subject}'")
            print(f"+ Exitoso")

        except Exception as e:
            print(f"- Error: {e}")

    print("\n" + "=" * 50)
    print("RESULTADO:")
    print("El sistema debería guardar los asuntos decodificados en la base de datos")

if __name__ == "__main__":
    test_subject_decoding()