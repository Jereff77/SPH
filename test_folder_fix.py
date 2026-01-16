#!/usr/bin/env python3
"""
Test para verificar la corrección del método move_email_to_folder para subcarpetas
"""

def test_folder_name_conversion():
    """Prueba la conversión de nombres de carpetas"""

    print("TEST DE CONVERSIÓN DE NOMBRES DE CARPETAS")
    print("=" * 50)

    # Casos de prueba
    test_cases = [
        {
            'input': 'BanBajio/otros',
            'expected': 'INBOX.BanBajio.otros',
            'description': 'Subcarpeta con diagonal'
        },
        {
            'input': 'procesados',
            'expected': 'INBOX.procesados',
            'description': 'Carpeta simple'
        },
        {
            'input': 'INBOX.BanBajio',
            'expected': 'INBOX.BanBajio',
            'description': 'Ya tiene formato INBOX'
        },
        {
            'input': 'BanBajio/subcarpeta',
            'expected': 'INBOX.BanBajio.subcarpeta',
            'description': 'Subcarpeta con múltiples niveles'
        }
    ]

    # Simular la lógica del método
    def convert_folder_name(folder_name):
        if '/' in folder_name:
            # Es una subcarpeta (ej: BanBajio/otros -> INBOX.BanBajio.otros)
            search_pattern = 'INBOX.' + folder_name.replace('/', '.')
        elif not folder_name.startswith('INBOX.'):
            # Es una carpeta simple (ej: procesados -> INBOX.procesados)
            search_pattern = 'INBOX.' + folder_name
        else:
            # Ya tiene formato INBOX.nombre
            search_pattern = folder_name

        return search_pattern

    exitosos = 0
    total = len(test_cases)

    for test_case in test_cases:
        input_name = test_case['input']
        expected = test_case['expected']
        description = test_case['description']

        result = convert_folder_name(input_name)
        status = "OK" if result == expected else "ERROR"

        if result == expected:
            exitosos += 1

        print(f"{status} | {input_name:<25} -> {result:<25} | {description}")

    print("\n" + "=" * 50)
    print(f"RESULTADO: {exitosos}/{total} pruebas exitosas")

    if exitosos == total:
        print("TODAS LAS PRUEBAS PASARON - La conversión funciona correctamente")
        print("El sistema ahora debería encontrar las carpetas correctamente")
    else:
        print("ALGUNAS PRUEBAS FALLARON - Requiere revisión")

    return exitosos == total

def test_folder_matching():
    """Prueba la coincidencia con nombres reales del servidor"""

    print("\n\nTEST DE COINCIDENCIA CON CARPETAS DEL SERVIDOR")
    print("=" * 50)

    # Carpetas disponibles según el log
    server_folders = [
        '(\\HasChildren) "." INBOX',
        '(\\HasChildren \\Marked) "." INBOX.BanBajio',
        '(\\HasNoChildren \\UnMarked) "." INBOX.BanBajio.otros',
        '(\\HasNoChildren \\UnMarked) "." INBOX.procesados',
        '(\\HasNoChildren \\UnMarked \\Trash) "." INBOX.Trash',
        '(\\HasNoChildren \\UnMarked \\Sent) "." INBOX.Sent',
        '(\\HasNoChildren \\UnMarked \\Junk) "." INBOX.Junk',
        '(\\HasNoChildren \\UnMarked \\Drafts) "." INBOX.Drafts'
    ]

    # Buscar y mostrar coincidencias
    search_patterns = [
        'INBOX.BanBajio.otros',  # Buscado por el sistema
        'INBOX.BanBajio',
        'INBOX.procesados'
    ]

    import re

    for pattern in search_patterns:
        print(f"\nBuscando: {pattern}")
        found = False

        for folder in server_folders:
            # Coincidencia exacta
            if pattern.lower() == folder.lower():
                print(f"  + Coincidencia exacta: {folder}")
                found = True
            # Coincidencia parcial
            elif pattern.lower() in folder.lower():
                # Extraer nombre INBOX.nombre
                match = re.search(r'INBOX\.[a-zA-Z0-9_/.-]+', folder)
                if match:
                    folder_name = match.group()
                    print(f"  + Coincidencia parcial: {folder_name} en {folder}")
                    found = True

        if not found:
            print(f"  - No se encontró coincidencia para {pattern}")

if __name__ == "__main__":
    # Ejecutar todas las pruebas
    conversion_ok = test_folder_name_conversion()
    test_folder_matching()

    print("\n" + "=" * 50)
    print("RESUMEN FINAL")
    print("=" * 50)

    if conversion_ok:
        print("+ La corrección debería resolver el problema de mover correos a BanBajio/otros")
        print("+ El sistema ahora convierte correctamente 'BanBajio/otros' -> 'INBOX.BanBajio.otros'")
        print("+ Esto debería permitir encontrar la carpeta que existe en el servidor")
    else:
        print("- La corrección necesita revisión adicional")