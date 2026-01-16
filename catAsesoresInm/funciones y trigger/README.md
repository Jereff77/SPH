# Funciones y Triggers - catAsesoresInm

## Overview
Este directorio contiene las funciones y triggers asociados a la tabla `catAsesoresInm` del sistema supaSPH-QR.

## Componentes Actuales

### 1. catasoresinm_validar_telefono.sql
- **Tipo**: Función
- **Descripción**: Valida si un teléfono ya existe en la tabla catAsesoresInm y retorna el nombre completo del usuario que lo registró
- **Parámetros**: 
  - `p_telefono` (text): Número de teléfono a validar
- **Retorno**: 
  - text: Nombre completo del usuario que registró el teléfono o NULL si no existe
- **Uso típico**: Validación de duplicidad de teléfonos antes de registrar un nuevo asesor inmobiliario

## Flujo de Procesamiento

```
Entrada de teléfono
        ↓
Búsqueda en catAsesoresInm
        ↓
¿Existe el teléfono? ──No──→ Retornar NULL
        ↓Sí
Verificar estado activo
        ↓
Obtener uidr del usuario
        ↓
Búsqueda en catUsers
        ↓
Construir nombre completo
        ↓
Retornar nombre completo
```

## Comportamiento Detallado

### catasoresinm_validar_telefono()
1. **Validación de entrada**: Recibe el número de teléfono como parámetro
2. **Búsqueda**: Busca coincidencias exactas en el campo `telefono` de `catAsesoresInm`
3. **Filtrado**: Solo considera registros con `status = true` en ambas tablas
4. **Join**: Realiza inner join con `catUsers` usando el campo `uidr`
5. **Construcción de resultado**: Concatena `nombre` y `apellidos` del usuario
6. **Retorno**: Devuelve el nombre completo o NULL si no encuentra coincidencias
7. **Manejo de errores**: En caso de excepción, retorna NULL

## Relaciones con Otras Tablas

- **catAsesoresInm**: Tabla principal donde se buscan los teléfonos
- **catUsers**: Tabla de donde se obtiene la información del usuario que registró

## Instrucciones de Instalación

1. Ejecutar el script `catasoresinm_validar_telefono.sql` en la base de datos
2. Verificar que la función se haya creado correctamente con:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'catasesoresinm_validar_telefono';
   ```

## Estado Actual
- **Total de funciones**: 1
- **Total de triggers**: 0
- **Última actualización**: 24/10/2025 00:18:11

## Notas Importantes
- La función utiliza SECURITY INVOKER para respetar las políticas de RLS
- Incluye manejo de excepciones para evitar errores en la aplicación
- Solo retorna resultados de registros activos (status = true)