# Carpeta de Imágenes - Proyecto supaSPH-QR

## 📁 Descripción

Esta carpeta contiene scripts y herramientas para la generación y gestión de imágenes dentro del proyecto supaSPH-QR utilizando la API de KLING AI.

## 📋 Componentes Actuales

### 1. ejecutar.py
Script de ejecución fácil para el generador de imágenes.

#### Funcionalidades
- Ejecución simplificada del generador de imágenes
- Detección automática de la ubicación de los scripts
- Manejo de errores básico

#### Uso
```bash
python ejecutar.py
```

### 2. generar_imagen_kling_ai_v3.py
Script de Python para generar imágenes utilizando la API de KLING AI (versión recomendada).

#### Funcionalidades
- Generación de imágenes a partir de descripciones textuales (prompts)
- Interfaz de línea de comandos para facilitar el uso
- Guardado automático de imágenes y respuestas de la API
- Soporte para diferentes modos (standard/pro)
- Soporte para diferentes estilos (fotográfico/animado/pintura)
- Carga segura de credenciales desde archivo .env
- Múltiples métodos de autenticación y URLs para probar

#### Uso
```bash
python generar_imagen_kling_ai_v3.py
```

### 3. generar_imagen_kling_ai.py y generar_imagen_kling_ai_v2.py
Versiones alternativas del generador de imágenes.

#### Uso
```bash
# Versión con múltiples métodos de autenticación
python generar_imagen_kling_ai_v2.py

# Versión inicial
python generar_imagen_kling_ai.py
```

### 4. instalar_todo.py
Script de instalación y configuración del entorno.

#### Funcionalidades
- Generación de imágenes a partir de descripciones textuales (prompts)
- Interfaz de línea de comandos para facilitar el uso
- Guardado automático de imágenes y respuestas de la API
- Soporte para diferentes modos (standard/pro)
- Soporte para diferentes estilos (fotográfico/animado/pintura)
- Carga segura de credenciales desde archivo .env

#### Uso
```bash
# Opción 1: Usar el script de ejecución (recomendado)
python ejecutar.py

# Opción 2: Ejecutar directamente el script v3
python generar_imagen_kling_ai_v3.py

# Opción 3: Si hay problemas de autenticación, probar con otras versiones
python generar_imagen_kling_ai_v2.py
python generar_imagen_kling_ai.py
```

#### Dependencias
- Python 3.6+
- requests (`pip install requests`)
- python-dotenv (`pip install python-dotenv`)

#### Ejemplo de uso
```
Ingrese la descripción de la imagen que desea generar: Un gato adorable en una ventana soleada
Ingrese el modo de generación (standard/pro) [por defecto: standard]: standard
Ingrese el estilo (fotográfico/animado/pintura) [por defecto: fotográfico]: fotográfico
```

### 2. instalar_todo.py
Script de instalación y configuración del entorno.

#### Funcionalidades
- Verificación de la versión de Python
- Instalación automática de dependencias
- Verificación de configuración de API
- Creación de directorios necesarios
- Generación de archivo con ejemplos de prompts

#### Uso
```bash
python instalar_todo.py
```

### 3. .env
Archivo de configuración con credenciales de API.

#### Contenido
- KLING_ACCESS_KEY: Clave de acceso para KLING AI
- KLING_SECRET_KEY: Clave secreta para KLING AI
- KLING_API_URL: URL base de la API de KLING AI

⚠️ **Importante**: Este archivo contiene información sensible y no debe ser compartido ni subido a repositorios públicos.

### 4. requirements.txt
Archivo con las dependencias del proyecto.

#### Contenido
- requests>=2.25.1: Para realizar solicitudes HTTP
- python-dotenv>=0.19.0: Para cargar variables de entorno

### 5. .gitignore
Archivo para ignorar archivos sensibles y generados automáticamente.

## 🔄 Flujo de Procesamiento

```
Usuario ingresa prompt → Configuración desde .env → API de KLING AI → Respuesta con imagen → Guardado local
```

## 📁 Estructura de Archivos Generados

Al ejecutar el script, se crea automáticamente una carpeta `imagenes_generadas/` con:
- Archivos JSON con la respuesta completa de la API
- Archivos de imagen descargados (PNG) cuando sea posible

## 🔐 Consideraciones de Seguridad

- Las credenciales se almacenan en el archivo .env que está excluido del control de versiones
- El archivo .gitignore evita la subida accidental de información sensible
- Las credenciales se cargan de forma segura usando python-dotenv
- No compartir tokens en repositorios públicos

## 📚 Documentación de Referencia

- [Documentación oficial de KLING AI](https://docs.klingai.com/)
- [Ejemplos de prompts para diferentes estilos](ejemplos_prompts.txt)

## 🚀 Instalación y Configuración

1. **Instalación automática** (recomendado):
   ```bash
   python instalar_todo.py
   ```

2. **Instalación manual**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar credenciales**:
   - Editar el archivo `.env`
   - Añadir las credenciales de KLING AI:
     ```
     KLING_ACCESS_KEY=tu_access_key
     KLING_SECRET_KEY=tu_secret_key
     ```

4. **Ejecutar el script**:
   ```bash
   # Opción 1: Usar el script de ejecución (recomendado)
   python ejecutar.py
   
   # Opción 2: Ejecutar directamente el script v3
   python generar_imagen_kling_ai_v3.py
   ```

## 🎛 Modos y Estilos Disponibles

### Modos de Generación
- **standard**: Generación estándar de imágenes
- **pro**: Generación de alta calidad (puede requerir créditos adicionales)

### Estilos de Imagen
- **fotográfico**: Estilo fotográfico realista
- **animado**: Estilo de animación
- **pintura**: Estilo de pintura artística

## 📝 Registro de Cambios

### 19/10/2025 - Migración a KLING AI
- **Cambio**: Migración de CogView-4 a KLING AI
- **Nuevos archivos**:
  - `generar_imagen_kling_ai.py` (reemplaza a generar_imagen_cogview4.py)
  - `.env` para credenciales de API
  - `.gitignore` para seguridad
- **Actualizaciones**:
  - `instalar_todo.py` actualizado para KLING AI
  - `requirements.txt` actualizado con python-dotenv
  - `README.md` actualizado con nueva documentación

### 19/10/2025 - Creación del script generador de imágenes
- **Creado**: Script `generar_imagen_cogview4.py`
- **Implementada**: Funcionalidad básica de generación de imágenes
- **Documentación**: Completa del script
- **Sistema**: Guardado automático de resultados

## 📋 Estado Actual

- [x] Script de generación de imágenes con KLING AI
- [x] Sistema de credenciales seguro con .env
- [x] Script de instalación automática
- [x] Documentación completa
- [x] Archivo .gitignore para seguridad
- [x] Ejemplos de prompts optimizados
- [ ] Script de procesamiento por lotes
- [ ] Integración con el sistema principal

## 🤝 Contribuciones

Para añadir nuevos componentes de imagen:
1. Crear el script en esta carpeta
2. Seguir el estándar de documentación del proyecto
3. Actualizar este README.md
4. Agregar ejemplos de uso
5. Asegurar que las credenciales se manejen de forma segura

## 📞 Soporte

Para dudas o problemas con el generador de imágenes, consultar:
1. La documentación oficial de KLING AI
2. Los ejemplos incluidos en el script
3. El registro de cambios para versiones recientes
4. Verificar la configuración del archivo .env