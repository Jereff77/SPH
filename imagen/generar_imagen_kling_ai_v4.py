#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de imágenes utilizando KLING AI (Versión 4)

Este script permite generar imágenes a partir de descripciones textuales (prompts)
utilizando el modelo de KLING AI con el método de autenticación correcto.

[Fecha y Hora]: 19/10/2025 04:35:00
[Descripción]: Script para generar imágenes con KLING AI mediante su API (Versión corregida)

[Uso típico]:
    python generar_imagen_kling_ai_v4.py
    
[Dependencias]:
    - requests
    - python-dotenv
    - json
    - os
    - datetime

[Ejemplo]:
    python generar_imagen_kling_ai_v4.py
    > Ingrese su descripción de imagen: Un gato adorable en una ventana soleada
    > Ingrese el modo (standard/pro): standard
"""

import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
load_dotenv()

def generar_imagen_kling_ai(prompt, modo="standard", estilo="fotográfico"):
    """
    Genera una imagen utilizando la API de KLING AI con el método correcto
    
    [Parámetros]:
        - prompt (str): Descripción de la imagen a generar
        - modo (str): Modo de generación ("standard" o "pro")
        - estilo (str): Estilo de la imagen (fotográfico, animado, etc.)
    
    [Salida]:
        - dict: Respuesta de la API con la imagen generada o mensaje de error
    
    [Relaciones]:
        - API de KLING AI
    """
    # Obtener credenciales desde variables de entorno
    access_key = os.getenv("KLING_ACCESS_KEY")
    secret_key = os.getenv("KLING_SECRET_KEY")
    
    if not access_key or not secret_key:
        return {
            "error": True,
            "message": "Las credenciales de KLING AI no están configuradas. Verifique el archivo .env"
        }
    
    # URL que funcionó (Método 6)
    url = "https://klingai.com/api/v1/images/generations"
    
    # Configurar headers con el método que funcionó
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_key}',
    }
    
    # Configurar datos de la solicitud - Probando diferentes formatos
    formatos_datos = [
        # Formato 1: Similar a OpenAI
        {
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
            "response_format": "url"
        },
        # Formato 2: Formato original
        {
            "prompt": prompt,
            "mode": modo,
            "style": estilo,
            "aspect_ratio": "16:9",
            "negative_prompt": "low quality, blurry, distorted",
            "num_images": 1
        },
        # Formato 3: Simplificado
        {
            "prompt": prompt,
            "style": estilo,
            "num_images": 1
        },
        # Formato 4: Solo prompt
        {
            "prompt": prompt
        }
    ]
    
    print(f"Enviando solicitud a la API de KLING AI...")
    print(f"URL: {url}")
    print(f"Prompt: {prompt}")
    print(f"Modo: {modo}")
    print(f"Estilo: {estilo}")
    
    # Probar cada formato de datos
    for i, data in enumerate(formatos_datos, 1):
        try:
            print(f"\nIntentando formato de datos {i}:")
            print(f"Datos: {json.dumps(data, indent=2)}")
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            
            print(f"Status Code: {response.status_code}")
            print(f"Respuesta: {response.text[:500]}...")
            
            if response.status_code == 200:
                try:
                    respuesta_json = response.json()
                    if respuesta_json:  # Si la respuesta no está vacía
                        print("¡Éxito! Respuesta JSON recibida.")
                        return respuesta_json
                    else:
                        print("Respuesta vacía, intentando siguiente formato...")
                except json.JSONDecodeError:
                    print("La respuesta no es JSON válido, intentando siguiente formato...")
            else:
                print(f"Error: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"Error de conexión: {str(e)}")
            continue
    
    # Si todos los métodos fallan, devolver error
    return {
        "error": True,
        "message": "Todos los formatos de datos fallaron. La API respondió con éxito pero con datos vacíos o no reconocidos."
    }

def guardar_imagen(respuesta_api, prompt, directorio_salida="imagenes_generadas"):
    """
    Guarda la imagen generada en un archivo
    
    [Parámetros]:
        - respuesta_api (dict): Respuesta de la API de KLING AI
        - prompt (str): Descripción original de la imagen
        - directorio_salida (str): Directorio donde se guardarán las imágenes
    
    [Salida]:
        - str: Ruta del archivo guardado o None si hubo error
    
    [Relaciones]:
        - Función generar_imagen_kling_ai
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
    
    # Buscar URLs de imagen en diferentes estructuras de respuesta
    url_imagen = None
    
    # Estructura 1: data[0].url (similar a OpenAI)
    if 'data' in respuesta_api and len(respuesta_api['data']) > 0:
        if 'url' in respuesta_api['data'][0]:
            url_imagen = respuesta_api['data'][0]['url']
    
    # Estructura 2: images[0].url
    if not url_imagen and 'images' in respuesta_api and len(respuesta_api['images']) > 0:
        if 'url' in respuesta_api['images'][0]:
            url_imagen = respuesta_api['images'][0]['url']
    
    # Estructura 3: image_url
    if not url_imagen and 'image_url' in respuesta_api:
        url_imagen = respuesta_api['image_url']
    
    # Estructura 4: url
    if not url_imagen and 'url' in respuesta_api:
        url_imagen = respuesta_api['url']
    
    # Si encontramos una URL, descargar la imagen
    if url_imagen:
        print(f"URL de la imagen generada: {url_imagen}")
        
        try:
            respuesta_imagen = requests.get(url_imagen)
            if respuesta_imagen.status_code == 200:
                nombre_imagen = f"{timestamp}_{prompt_limpio}.png"
                ruta_imagen = os.path.join(directorio_salida, nombre_imagen)
                
                with open(ruta_imagen, 'wb') as f:
                    f.write(respuesta_imagen.content)
                
                print(f"Imagen descargada y guardada en: {ruta_imagen}")
                return ruta_imagen
            else:
                print(f"No se pudo descargar la imagen. Status: {respuesta_imagen.status_code}")
        except Exception as e:
            print(f"No se pudo descargar la imagen: {str(e)}")
    else:
        print("No se encontró URL de imagen en la respuesta.")
        print("Estructura de la respuesta:")
        print(json.dumps(respuesta_api, indent=2))
    
    return ruta_archivo

def main():
    """
    Función principal del script
    
    [Uso típico]: Ejecución del script para generar imágenes desde línea de comandos
    """
    print("=" * 60)
    print("Generador de Imágenes con KLING AI (Versión 4)")
    print("Proyecto supaSPH-QR")
    print("=" * 60)
    
    # Solicitar el prompt al usuario
    prompt = input("\nIngrese la descripción de la imagen que desea generar: ")
    if not prompt.strip():
        print("Error: El prompt no puede estar vacío.")
        return
    
    # Solicitar el modo de generación
    modo = input("Ingrese el modo de generación (standard/pro) [por defecto: standard]: ")
    if not modo.strip():
        modo = "standard"
    elif modo not in ["standard", "pro"]:
        print("Modo no válido. Se usará 'standard' por defecto.")
        modo = "standard"
    
    # Solicitar el estilo
    estilo = input("Ingrese el estilo (fotográfico/animado/pintura) [por defecto: fotográfico]: ")
    if not estilo.strip():
        estilo = "fotográfico"
    
    print("\nProcesando solicitud...")
    
    # Generar la imagen
    respuesta = generar_imagen_kling_ai(prompt, modo, estilo)
    
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