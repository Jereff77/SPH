# Diagnóstico de Política RLS para la tabla naves

## 📋 Propósito

Este script está diseñado para diagnosticar problemas con la política RLS de la tabla `naves` que filtra por parques asignados al usuario.

## 🚀 Cómo usar

### 1. Preparar el entorno

Asegúrate de tener Node.js instalado en tu sistema.

### 2. Instalar dependencias

```bash
npm install pg dotenv
```

### 3. Configurar las credenciales

Copia el archivo `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```
DB_HOST=tu_host_supabase
DB_PORT=5432
DB_NAME=tu_base_de_datos
DB_USER=bruno.levet@aceleremos.com
DB_PASSWORD=Holamundo#12
```

### 4. Ejecutar el diagnóstico

```bash
node diagnosticar_rls.js
```

## 🔍 Qué verifica el script

1. **Autenticación del usuario**: Verifica si el usuario está autenticado
2. **Existencia en catUsers**: Comprueba si el usuario existe en la tabla catUsers
3. **Estado del usuario**: Verifica si el usuario está activo
4. **Parques asignados**: Analiza la estructura y contenido del campo parques
5. **Acceso a naves**: Intenta consultar la tabla naves
6. **Política RLS**: Muestra las políticas RLS aplicadas a la tabla naves

## 📊 Resultados esperados

El script mostrará información detallada sobre cada paso, incluyendo:
- UID del usuario autenticado
- Estado y parques asignados del usuario
- Estructura de los datos de parques
- Resultados de las consultas a la tabla naves
- Políticas RLS aplicadas

## 🐛 Solución de problemas

Si el script muestra errores, anota:
- El mensaje de error exacto
- El paso en el que ocurre el error
- Los valores mostrados por el script

Esta información nos ayudará a identificar y corregir el problema con la política RLS.