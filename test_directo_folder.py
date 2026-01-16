#!/usr/bin/env python3
"""
Test directo del método move_email_to_folder para verificar si funciona la corrección
"""

import re

def test_folder_conversion():
    """Test directo del método de conversión de carpetas"""

    print("TEST DIRECTO DE MÉTODO move_email_to_folder")
    print("=" * 50)

    # Simular las carpetas que devuelve el servidor
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

    # Probar la conversión para diferentes carpetas
    test_cases = [
        'BanBajio/otros',
        'procesados',
        'BanBajio'
    ]

    for folder_name in test_cases:
        print(f"\nProbando con: '{folder_name}'")

        # Aplicar la lógica del método corregido
        if '/' in folder_name:
            # Es una subcarpeta (ej: BanBajio/otros -> INBOX.BanBajio.otros)
            search_pattern = 'INBOX.' + folder_name.replace('/', '.')
        elif not folder_name.startswith('INBOX.'):
            # Es una carpeta simple (ej: procesados -> INBOX.procesados)
            search_pattern = 'INBOX.' + folder_name
        else:
            # Ya tiene formato INBOX.nombre
            search_pattern = folder_name

        print(f"  Patrón de búsqueda: '{search_pattern}'")

        folder_found = False
        folder_to_use = folder_name

        for folder in server_folders:
            # Buscar coincidencia exacta con el patrón INBOX.nombre
            if search_pattern.lower() == folder.lower():
                folder_found = True
                folder_to_use = folder
                print(f"  + Coincidencia exacta: '{folder_to_use}'")
                break

            # También buscar si el patrón está contenido en el string de la carpeta
            if search_pattern.lower() in folder.lower():
                folder_found = True
                # Extraer el nombre INBOX.nombre completo
                match = re.search(r'INBOX\.[a-zA-Z0-9_/.-]+', folder)
                if match:
                    folder_to_use = match.group()
                else:
                    folder_to_use = folder
                print(f"  + Coincidencia parcial: '{folder_to_use}'")
                break

        if not folder_found:
            print(f"  - No se encontró la carpeta '{folder_name}'")
        else:
            print(f"  + Exito: '{folder_name}' -> '{folder_to_use}'")

if __name__ == "__main__":
    test_folder_conversion()