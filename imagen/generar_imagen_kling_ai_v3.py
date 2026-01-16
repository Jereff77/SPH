#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de imágenes utilizando KLING AI (Versión 3)

Este script permite generar imágenes a partir de descripciones textuales (prompts)
utilizando el modelo de KLING AI con métodos de autenticación simplificados.

[Fecha y Hora]: 19/10/2025 04:25:00
[Descripción]: Script para generar imágenes con KLING AI mediante su API (Versión simplificada)

[Uso típico]:
    python generar_imagen_kling_ai_v3.py
    
[Dependencias]:
    - requests
    - python-dotenv
    - json
    - os
    - datetime

[Ejemplo]:
    python generar_imagen_kling_ai_v3.py
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
    Genera una imagen utilizando la API de KLING AI con métodos simplificados
    
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
    
    # Configurar datos de la solicitud
    data = {
        "prompt": prompt,
        "mode": modo,
        "style": estilo,
        "aspect_ratio": "16:9",
        "negative_prompt": "low quality, blurry, distorted",
        "num_images": 1
    }
    
    # Lista de posibles URLs y métodos de autenticación para probar
    configuraciones = [
        {
            "url": "https://api.klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            },
            "nombre": "Método 1: Bearer con Access Key"
        },
        {
            "url": "https://api.klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}:{secret_key}',
            },
            "nombre": "Método 2: Bearer con Access Key:Secret Key"
        },
        {
            "url": "https://api.klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'X-API-Key': access_key,
                'X-API-Secret': secret_key,
            },
            "nombre": "Método 3: Headers X-API-Key y X-API-Secret"
        },
        {
            "url": "https://api.klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'apikey': access_key,
                'apisecret': secret_key,
            },
            "nombre": "Método 4: Headers apikey y apisecret"
        },
        {
            "url": "https://api.klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'KLING {access_key}:{secret_key}',
            },
            "nombre": "Método 5: Authorization KLING con Access Key:Secret Key"
        },
        # URLs alternativas
        {
            "url": "https://klingai.com/api/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            },
            "nombre": "Método 6: URL alternativa con Bearer"
        },
        {
            "url": "https://klingai.com/v1/images/generations",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            },
            "nombre": "Método 7: URL alternativa sin /api"
        },
        # Intentando con diferentes endpoints
        {
            "url": "https://api.klingai.com/v1/generate/image",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            },
            "nombre": "Método 8: Endpoint /generate/image"
        },
        {
            "url": "https://api.klingai.com/v1/image/generate",
            "headers": {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_key}',
            },
            "nombre": "Método 9: Endpoint /image/generate"
        }
    ]
    
    print(f"Enviando solicitud a la API de KLING AI...")
    print(f"Prompt: {prompt}")
    print(f"Modo: {modo}")
    print(f"Estilo: {estilo}")
    
    # Probar cada configuración hasta encontrar una que funcione
    for config in configuraciones:
        try:
            print(f"\nIntentando: {config['nombre']}")
            print(f"URL: {config['url']}")
            
            response = requests.post(config['url'], headers=config['headers'], json=data, timeout=30)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("¡Éxito! Respuesta recibida.")
                return response.json()
            else:
                print(f"Error: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"Error de conexión: {str(e)}")
            continue
    
    # Si todos los métodos fallan, devolver error
    return {
        "error": True,
        "message": "Todos los métodos de autenticación fallaron. Verifique las credenciales y la URL de la API."
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
    print("Generador de Imágenes con KLING AI (Versión 3)")
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