#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de imágenes utilizando KLING AI

Este script permite generar imágenes a partir de descripciones textuales (prompts)
utilizando el modelo de KLING AI.

[Fecha y Hora]: 19/10/2025 03:34:00
[Descripción]: Script para generar imágenes con KLING AI mediante su API

[Uso típico]:
    python generar_imagen_kling_ai.py
    
[Dependencias]:
    - requests
    - python-dotenv
    - json
    - os
    - datetime
    - base64
    - hashlib
    - hmac
    - time

[Ejemplo]:
    python generar_imagen_kling_ai.py
    > Ingrese su descripción de imagen: Un gato adorable en una ventana soleada
    > Ingrese el modo (standard/pro): standard
"""

import requests
import json
import os
import base64
import hashlib
import hmac
import time
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
load_dotenv()

def generar_firma(access_key, secret_key, method, path, timestamp):
    """
    Genera la firma HMAC-SHA256 para la autenticación con la API de KLING AI
    
    [Parámetros]:
        - access_key (str): Clave de acceso de KLING AI
        - secret_key (str): Clave secreta de KLING AI
        - method (str): Método HTTP (POST)
        - path (str): Ruta del endpoint de la API
        - timestamp (str): Timestamp de la solicitud
    
    [Salida]:
        - str: Firma generada en formato Base64
    
    [Relaciones]:
        - API de KLING AI
    """
    # Crear el string a firmar
    string_to_sign = f"{method}\n{path}\n{timestamp}\n"
    
    # Generar la firma HMAC-SHA256
    signature = hmac.new(
        secret_key.encode('utf-8'),
        string_to_sign.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Convertir a Base64
    signature_base64 = base64.b64encode(signature).decode('utf-8')
    
    return signature_base64

def generar_imagen_kling_ai(prompt, modo="standard", estilo="fotográfico"):
    """
    Genera una imagen utilizando la API de KLING AI
    
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
    api_url = os.getenv("KLING_API_URL", "https://api.klingai.com/v1")
    
    if not access_key or not secret_key:
        return {
            "error": True,
            "message": "Las credenciales de KLING AI no están configuradas. Verifique el archivo .env"
        }
    
    # Configuración de la solicitud
    endpoint = "/images/generations"
    method = "POST"
    path = "/v1/images/generations"
    timestamp = str(int(time.time()))
    
    # Generar firma
    signature = generar_firma(access_key, secret_key, method, path, timestamp)
    
    # Configurar headers - Intentando diferentes métodos de autenticación
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_key}:{secret_key}',  # Método alternativo
        'X-API-Key': access_key,  # Método alternativo
        'X-API-Secret': secret_key,  # Método alternativo
    }
    
    # Configurar datos de la solicitud
    data = {
        "prompt": prompt,
        "mode": modo,
        "style": estilo,
        "aspect_ratio": "16:9",
        "negative_prompt": "low quality, blurry, distorted",
        "num_images": 1
    }
    
    try:
        print(f"Enviando solicitud a la API de KLING AI...")
        print(f"Prompt: {prompt}")
        print(f"Modo: {modo}")
        print(f"Estilo: {estilo}")
        
        response = requests.post(f"{api_url}{endpoint}", headers=headers, json=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            # Si falla, intentar con otro método de autenticación
            print(f"Intentando método alternativo de autenticación...")
            
            # Método 2: Solo API Key en Authorization
            headers_alt = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            }
            
            response = requests.post(f"{api_url}{endpoint}", headers=headers_alt, json=data)
            
            if response.status_code == 200:
                return response.json()
            else:
                # Método 3: API Key en header X-API-Key
                headers_alt2 = {
                    'Content-Type': 'application/json',
                    'X-API-Key': access_key,
                }
                
                response = requests.post(f"{api_url}{endpoint}", headers=headers_alt2, json=data)
                
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
    print("Generador de Imágenes con KLING AI")
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