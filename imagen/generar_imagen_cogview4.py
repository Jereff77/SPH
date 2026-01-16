#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de imágenes utilizando CogView-4 de Z.AI

Este script permite generar imágenes a partir de descripciones textuales (prompts)
utilizando el modelo CogView-4 de la API de Z.AI.

[Fecha y Hora]: 19/10/2025 01:59:00
[Descripción]: Script para generar imágenes con CogView-4 mediante la API de Z.AI

[Uso típico]:
    python generar_imagen_cogview4.py
    
[Dependencias]:
    - requests
    - json
    - os
    - datetime

[Ejemplo]:
    python generar_imagen_cogview4.py
    > Ingrese su descripción de imagen: Un gato adorable en una ventana soleada
    > Ingrese su token de API: xxxxxx
"""

import requests
import json
import os
import sys
from datetime import datetime

def generar_imagen_cogview4(prompt, token_api, tamaño="1024x1024"):
    """
    Genera una imagen utilizando el modelo CogView-4 de Z.AI
    
    [Parámetros]:
        - prompt (str): Descripción de la imagen a generar
        - token_api (str): Token de autorización para la API de Z.AI
        - tamaño (str): Tamaño de la imagen (por defecto: "1024x1024")
    
    [Salida]:
        - dict: Respuesta de la API con la imagen generada o mensaje de error
    
    [Relaciones]:
        - API de Z.AI CogView-4
    """
    url = "https://api.z.ai/api/paas/v4/images/generations"
    
    headers = {
        'Authorization': f'Bearer {token_api}',
        'Content-Type': 'application/json'
    }
    
    data = {
        "model": "cogView-4-250304",
        "prompt": prompt,
        "size": tamaño
    }
    
    try:
        print(f"Enviando solicitud a la API de Z.AI...")
        print(f"Prompt: {prompt}")
        print(f"Tamaño: {tamaño}")
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "error": True,
                "status_code": response.status_code,
                "message": response.text
            }
    
    except requests.exceptions.RequestException as e:
        return {
            "error": True,
            "message": f"Error de conexión: {str(e)}"
        }

def guardar_imagen(respuesta_api, prompt, directorio_salida="imagenes_generadas"):
    """
    Guarda la imagen generada en un archivo
    
    [Parámetros]:
        - respuesta_api (dict): Respuesta de la API de Z.AI
        - prompt (str): Descripción original de la imagen
        - directorio_salida (str): Directorio donde se guardarán las imágenes
    
    [Salida]:
        - str: Ruta del archivo guardado o None si hubo error
    
    [Relaciones]:
        - Función generar_imagen_cogview4
    """
    if respuesta_api.get("error"):
        print(f"Error en la respuesta de la API: {respuesta_api.get('message')}")
        return None
    
    # Crear directorio de salida si no existe
    if not os.path.exists(directorio_salida):
        os.makedirs(directorio_salida)
        print(f"Directorio creado: {directorio_salida}")
    
    # Generar nombre de archivo basado en el prompt y timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prompt_limpio = "".join(c for c in prompt if c.isalnum() or c in (' ', '-', '_')).rstrip()
    prompt_limpio = prompt_limpio.replace(' ', '_')[:30]  # Limitar longitud
    nombre_archivo = f"{timestamp}_{prompt_limpio}.json"
    ruta_archivo = os.path.join(directorio_salida, nombre_archivo)
    
    # Guardar respuesta completa en formato JSON
    with open(ruta_archivo, 'w', encoding='utf-8') as f:
        json.dump(respuesta_api, f, indent=2, ensure_ascii=False)
    
    print(f"Respuesta guardada en: {ruta_archivo}")
    
    # Si la respuesta contiene una URL de imagen, guardar esa información
    if 'data' in respuesta_api and len(respuesta_api['data']) > 0:
        if 'url' in respuesta_api['data'][0]:
            url_imagen = respuesta_api['data'][0]['url']
            print(f"URL de la imagen generada: {url_imagen}")
            
            # Opcionalmente descargar la imagen
            try:
                respuesta_imagen = requests.get(url_imagen)
                if respuesta_imagen.status_code == 200:
                    nombre_imagen = f"{timestamp}_{prompt_limpio}.png"
                    ruta_imagen = os.path.join(directorio_salida, nombre_imagen)
                    
                    with open(ruta_imagen, 'wb') as f:
                        f.write(respuesta_imagen.content)
                    
                    print(f"Imagen descargada y guardada en: {ruta_imagen}")
                    return ruta_imagen
            except Exception as e:
                print(f"No se pudo descargar la imagen: {str(e)}")
    
    return ruta_archivo

def main():
    """
    Función principal del script
    
    [Uso típico]: Ejecución del script para generar imágenes desde línea de comandos
    """
    print("=" * 60)
    print("Generador de Imágenes con CogView-4 (Z.AI)")
    print("=" * 60)
    
    # Solicitar el prompt al usuario
    prompt = input("\nIngrese la descripción de la imagen que desea generar: ")
    if not prompt.strip():
        print("Error: El prompt no puede estar vacío.")
        sys.exit(1)
    
    # Solicitar el token de API
    token_api = input("Ingrese su token de API de Z.AI: ")
    if not token_api.strip():
        print("Error: El token de API no puede estar vacío.")
        sys.exit(1)
    
    # Solicitar tamaño de imagen (opcional)
    tamaño = input("Ingrese el tamaño de la imagen (1024x1024, 512x512, 256x256) [por defecto: 1024x1024]: ")
    if not tamaño.strip():
        tamaño = "1024x1024"
    
    print("\nProcesando solicitud...")
    
    # Generar la imagen
    respuesta = generar_imagen_cogview4(prompt, token_api, tamaño)
    
    # Guardar la imagen
    resultado = guardar_imagen(respuesta, prompt)
    
    if resultado:
        print("\n¡Proceso completado con éxito!")
        print(f"Archivo guardado en: {resultado}")
    else:
        print("\nHubo un error al procesar la solicitud.")
        if "message" in respuesta:
            print(f"Detalles del error: {respuesta['message']}")

if __name__ == "__main__":
    main()