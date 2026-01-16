# Funciones Generales

Este directorio contiene funciones de utilidad general que no están asociadas a una tabla específica del proyecto supaSPH-QR.

## 📁 Archivos

### Funciones

1. **`cdg.sql`**
   - **Tipo**: Función de consulta
   - **Propósito**: Desencriptar y ejecutar queries seguros (CDG)
   - **Seguridad**: Solo permite consultas SELECT
   - **Mecanismo**: Desencriptación XOR con SHA256

## 🔐 Seguridad

- **cdg**: Utiliza doble capa de seguridad (clave servidor + cliente)
- Solo permite ejecución de consultas SELECT
- Validación de estructura del query antes de ejecución

## 📋 Comportamiento Detallado

### Función cdg
1. Recibe query encriptado y parte de la clave
2. Combina con parte de la clave del servidor
3. Desencripta usando algoritmo XOR con SHA256
4. Valida que sea una consulta SELECT
5. Ejecuta y retorna resultados en formato JSON

## 📊 Estado Actual

- **Funciones documentadas**: 1
- **Relaciones con otras tablas**: Múltiples (depende del query)
- **Impacto**: Ejecución segura de consultas dinámicas

## 📝 Notas

- La función está diseñada para ser segura contra inyección SQL
- Solo permite consultas SELECT para evitar modificaciones no autorizadas
- Los resultados se retornan siempre en formato JSON
- Incluye manejo de errores con mensajes específicos