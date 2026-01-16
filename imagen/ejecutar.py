#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de ejecución para el generador de imágenes con KLING AI

Este script facilita la ejecución del generador de imágenes desde cualquier ubicación.

[Fecha y Hora]: 19/10/2025 04:30:00
[Descripción]: Script de ejecución para el generador de imágenes

[Uso típico]:
    python ejecutar.py
    
[Dependencias]:
    - os
    - sys
    - subprocess

[Ejemplo]:
    python ejecutar.py
"""

import os
import sys
import subprocess

def main():
    """
    Función principal del script de ejecución
    
    [Uso típico]: Ejecución del script para iniciar el generador de imágenes
    """
    # Obtener el directorio actual del script
    directorio_actual = os.path.dirname(os.path.abspath(__file__))
    
    # Ruta al script v4 (con el método correcto de autenticación)
    ruta_script = os.path.join(directorio_actual, "generar_imagen_kling_ai_v4.py")
    
    # Verificar si el script existe
    if not os.path.exists(ruta_script):
        print(f"Error: No se encuentra el script {ruta_script}")
        return
    
    print("=" * 60)
    print("Ejecutando Generador de Imágenes con KLING AI (Versión 4)")
    print("Proyecto supaSPH-QR")
    print("=" * 60)
    print(f"Script: {ruta_script}")
    print("-" * 60)
    
    try:
        # Ejecutar el script
        subprocess.run([sys.executable, ruta_script], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error al ejecutar el script: {e}")
    except KeyboardInterrupt:
        print("\nEjecución interrumpida por el usuario.")
    except Exception as e:
        print(f"Error inesperado: {e}")

if __name__ == "__main__":
    main()