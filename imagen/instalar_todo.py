#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de instalación para el generador de imágenes con KLING AI

Este script facilita la instalación de dependencias y configuración inicial
para el generador de imágenes del proyecto supaSPH-QR.

[Fecha y Hora]: 19/10/2025 03:36:00
[Descripción]: Script de instalación para el módulo de generación de imágenes con KLING AI

[Uso típico]:
    python instalar_todo.py

[Dependencias]:
    - pip
    - Python 3.6+

[Ejemplo]:
    python instalar_todo.py
"""

import os
import sys
import subprocess
from datetime import datetime

def verificar_python():
    """
    Verifica si la versión de Python es compatible
    
    [Salida]:
        - bool: True si la versión es compatible, False en caso contrario
    """
    version = sys.version_info
    print(f"Versión de Python detectada: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 6):
        print("Error: Se requiere Python 3.6 o superior.")
        return False
    
    return True

def instalar_dependencias():
    """
    Instala las dependencias necesarias desde requirements.txt
    
    [Salida]:
        - bool: True si la instalación fue exitosa, False en caso contrario
    """
    print("\nInstalando dependencias desde requirements.txt...")
    
    try:
        # Verificar si pip está disponible
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      check=True, capture_output=True)
        
        # Instalar dependencias
        resultado = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                                 check=True, capture_output=True, text=True)
        
        print("✓ Dependencias instaladas correctamente.")
        return True
    
    except subprocess.CalledProcessError as e:
        print(f"Error al instalar dependencias: {e}")
        print(f"Salida de error: {e.stderr}")
        return False

def verificar_configuracion():
    """
    Verifica que el archivo .exist y tenga las credenciales configuradas
    
    [Salida]:
        - bool: True si la configuración es correcta, False en caso contrario
    """
    print("\nVerificando configuración de API...")
    
    if not os.path.exists(".env"):
        print("✗ El archivo .env no existe.")
        return False
    
    # Cargar variables de entorno
    from dotenv import load_dotenv
    load_dotenv()
    
    access_key = os.getenv("KLING_ACCESS_KEY")
    secret_key = os.getenv("KLING_SECRET_KEY")
    
    if not access_key:
        print("✗ La variable KLING_ACCESS_KEY no está configurada en el archivo .env")
        return False
    
    if not secret_key:
        print("✗ La variable KLING_SECRET_KEY no está configurada en el archivo .env")
        return False
    
    print("✓ Configuración de API verificada correctamente.")
    return True

def crear_directorio_salida():
    """
    Crea el directorio de salida para las imágenes generadas
    
    [Salida]:
        - str: Ruta del directorio creado
    """
    directorio = "imagenes_generadas"
    
    if not os.path.exists(directorio):
        os.makedirs(directorio)
        print(f"✓ Directorio de salida creado: {directorio}")
    else:
        print(f"✓ Directorio de salida ya existe: {directorio}")
    
    return directorio

def crear_archivo_ejemplo():
    """
    Crea un archivo de ejemplo con prompts de prueba
    
    [Salida]:
        - str: Ruta del archivo creado
    """
    ejemplos = [
        "Un gato adorable en una ventana soleada, con el fondo de cielo azul y nubes blancas.",
        "Una taza de café humeante sobre una mesa de madera en un café acogedor.",
        "Un paisaje montañoso al atardecer con colores vibrantes.",
        "Un robot futurista trabajando en un laboratorio de alta tecnología.",
        "Un plato de sushi fresco y colorido sobre una tabla de bambú.",
        "Un dragón volando sobre un castillo medieval en un día nublado.",
        "Un jardín japonés en primavera con cerezos en flor.",
        "Un astronauta caminando en la superficie de Marte."
    ]
    
    contenido = """# Ejemplos de Prompts para KLING AI
# Proyecto supaSPH-QR

# [Fecha y Hora]: 19/10/2025 03:36:00
# [Descripción]: Archivo con ejemplos de prompts para generación de imágenes con KLING AI

# Ejemplos de prompts para generar imágenes con KLING AI:
"""
    
    for i, ejemplo in enumerate(ejemplos, 1):
        contenido += f"\n# Ejemplo {i}\n{ejemplo}\n"
    
    contenido += """
# Notas para mejores resultados con KLING AI:
# - Sé específico y detallado en tus descripciones
# - Incluye información sobre estilo, iluminación y composición
# - Evita descripciones contradictorias
# - Experimenta con diferentes modos (standard/pro)
# - Prueba diferentes estilos (fotográfico/animado/pintura)
# - Usa prompts en inglés para mejores resultados en algunos casos

# Ejemplos de prompts en inglés:
# A majestic lion standing on a rock at sunset, photorealistic style
# A futuristic city with flying cars, neon lights, cyberpunk style
# A peaceful beach with palm trees and crystal clear water, tropical paradise
"""
    
    archivo = "ejemplos_prompts.txt"
    
    with open(archivo, 'w', encoding='utf-8') as f:
        f.write(contenido)
    
    print(f"✓ Archivo de ejemplos creado: {archivo}")
    return archivo

def mostrar_instrucciones():
    """
    Muestra las instrucciones de uso después de la instalación
    """
    print("\n" + "=" * 60)
    print("¡INSTALACIÓN COMPLETADA CON ÉXITO!")
    print("=" * 60)
    
    print("\nPara usar el generador de imágenes con KLING AI:")
    print("1. Asegúrate de que el archivo .env contiene tus credenciales")
    print("2. Ejecuta el script principal:")
    print("   python generar_imagen_kling_ai.py")
    print("3. Sigue las instrucciones en pantalla")
    
    print("\nPara consultar ejemplos de prompts:")
    print("   cat ejemplos_prompts.txt")
    
    print("\nLas imágenes generadas se guardarán en:")
    print("   imagenes_generadas/")
    
    print("\nModos disponibles:")
    print("   - standard: Generación estándar de imágenes")
    print("   - pro: Generación de alta calidad (puede requerir créditos adicionales)")
    
    print("\nEstilos disponibles:")
    print("   - fotográfico: Estilo fotográfico realista")
    print("   - animado: Estilo de animación")
    print("   - pintura: Estilo de pintura artística")
    
    print("\nDocumentación adicional:")
    print("   https://docs.klingai.com/")

def main():
    """
    Función principal del script de instalación
    
    [Uso típico]: Ejecución del script para configurar el entorno
    """
    print("=" * 60)
    print("Instalador - Generador de Imágenes KLING AI")
    print("Proyecto supaSPH-QR")
    print("=" * 60)
    
    # Verificar versión de Python
    if not verificar_python():
        sys.exit(1)
    
    # Instalar dependencias
    if not instalar_dependencias():
        print("\nError: No se pudieron instalar las dependencias.")
        print("Intenta instalar manualmente: pip install -r requirements.txt")
        sys.exit(1)
    
    # Verificar configuración
    if not verificar_configuracion():
        print("\nError: La configuración de la API no es correcta.")
        print("Asegúrate de que el archivo .env exista y contenga las credenciales necesarias.")
        sys.exit(1)
    
    # Crear directorio de salida
    crear_directorio_salida()
    
    # Crear archivo de ejemplos
    crear_archivo_ejemplo()
    
    # Mostrar instrucciones finales
    mostrar_instrucciones()

if __name__ == "__main__":
    main()