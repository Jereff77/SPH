# Funciones y Triggers - QRGenerados

## 📋 Descripción General

Esta carpeta contiene las funciones y triggers asociados a la tabla `qrGenerados`, que gestiona los códigos QR generados para el control de accesos al sistema.

## 📁 Componentes Actuales

### Funciones

#### 1. `qrgenerados_validar_acceso.sql`
- **Propósito**: Validar códigos QR para control de accesos con validación de tiempo
- **Descripción**: Función principal que verifica la vigencia de códigos QR, valida fechas y región, registra entradas/salidas y valida tiempo mínimo entre operaciones
- **Parámetros**:
  - `p_clave_acceso` (text): Clave de acceso de 15 caracteres
- **Retorno**: JSON con estado de validación, datos del visitante y detalles del resultado
- **Status codes**:
  - `0`: Código inválido
  - `1`: Entrada registrada
  - `2`: Salida registrada
  - `3`: Tiempo mínimo no cumplido (menos de 5 minutos desde entrada)
  - `4`: Código ya utilizado
- **Campos adicionales en respuesta**:
  - `mensaje`: Descripción detallada del resultado
  - `exito`: Booleano que indica si la operación fue exitosa
  - `hora_registro`: Fecha/hora actual de la operación en zona horaria de México
- **Validación de tiempo**: Requiere un mínimo de 5 minutos entre entrada y salida para evitar registros dobles

#### 2. `qrgenerados_obtener_registros_dia.sql`
- **Propósito**: Obtener registros de accesos del día actual
- **Descripción**: Función que retorna todos los registros cuya entrada o salida ocurrieron en el día actual
- **Parámetros**: No requiere parámetros
- **Retorno**: TABLE con información completa de accesos del día
- **Campos retornados**:
  - `id_qr`: UUID del registro
  - `clave_acceso`: Clave de acceso de 15 caracteres
  - `nombre_visitante`: Nombre completo del visitante
  - `placas_vehiculo`: Placas del vehículo
  - `tipo_vehiculo`: Tipo de vehículo
  - `fec_entrada`: Fecha/hora de entrada (timestamp sin zona horaria, como está en tabla)
  - `fec_salida`: Fecha/hora de salida (timestamp sin zona horaria, como está en tabla)
  - `estado`: Estado del proceso (1=Pendiente, 2=En uso, 3=Terminada)
  - `url_identificacion`: URL de identificación del visitante

## 🔄 Flujo de Procesamiento

```
Flujo 1: Validación de Accesos (qrgenerados_validar_acceso)
Entrada: Clave de acceso QR
    ↓
Verificar existencia y estado activo
    ↓
Validar vigencia del código
    ↓
Verificar fecha de validez (horario México)
    ↓
Obtener datos del visitante
    ↓
Determinar tipo de operación:
    • fecEntrada = NULL, fecSalida = NULL → Registrar entrada (status=1)
    • fecEntrada ≠ NULL, fecSalida = NULL → Validar tiempo mínimo:
        - Si han pasado ≥5 minutos → Registrar salida (status=2)
        - Si han pasado <5 minutos → Rechazar (status=3)
    • fecEntrada ≠ NULL, fecSalida ≠ NULL → Código usado (status=4)
    ↓
Actualizar campos correspondientes
    ↓
Retornar JSON con resultado

Flujo 2: Obtener Registros del Día (qrgenerados_obtener_registros_dia)
Entrada: Sin parámetros
    ↓
Generar registros donde:
   • Un registro por cada entrada del día actual
   • Un registro por cada salida del día actual
• Se incluye ID, nombre de la empresa y ID del parque obtenido desde qrEmpresas y empresas
• Se muestran todos los eventos ordenados por fecha_evento DESC (más reciente primero)
    ↓
Unir con datosVisitantes
    ↓
Ordenar por fecha más reciente
    ↓
Retornar TABLE con registros del día
```

## 🔗 Relaciones con Otras Tablas

- **qrGenerados**: Tabla principal que contiene los códigos y su estado
- **datosVisitantes**: Proporciona información del visitante (nombre, placas, tipo vehículo, identificación)

## 📊 Estado Actual

- **Total de funciones**: 2
- **Total de triggers**: 0
- **Última actualización**: 01/12/2025 17:01:00

## 🚀 Instrucciones de Instalación

Ejecutar el script `instalar_todo.sql` para instalar todos los componentes en el orden correcto:

```sql
-- Instalar función de validación de accesos
\i QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql

-- Instalar función de obtención de registros del día
\i QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql
```

## 📝 Notas Importantes

1. **Zona Horaria**: Todas las validaciones de fecha/hora consideran el horario de México (UTC-6) usando explícitamente `AT TIME ZONE 'America/Mexico_City'`
2. **Seguridad**: Ambas funciones utilizan SECURITY INVOKER para respetar políticas RLS
3. **Manejo de Errores**: En caso de cualquier excepción, retorna status=0 (validación) o array vacío (registros día)
4. **Actualización Automática**: Cuando se registra salida, el código se marca como inválido automáticamente
5. **Filtrado Inteligente**: La función de registros del día incluye tanto entradas como salidas del día actual
6. **Timestamps**: Los timestamps se muestran exactamente como están almacenados en la tabla (sin zona horaria)
7. **Validación de Tiempo**: Se requiere un mínimo de 5 minutos entre entrada y salida para evitar registros duplicados por escaneo accidental
8. **Mensaje Informativo**: Cuando no se cumple el tiempo mínimo, se muestra el tiempo restante en minutos

## 🔐 Consideraciones de Seguridad

- La función respeta las políticas RLS de la tabla qrGenerados
- Solo usuarios con permisos pueden acceder a los datos de visitantes
- Los códigos QR se desactivan automáticamente después del uso completo

## 📅 Historial de Cambios

- **01/12/2025 17:01:00**: Adición de validación de tiempo mínimo en función `qrgenerados_validar_acceso`
  - Se agregó validación de 5 minutos mínimos entre entrada y salida
  - Nuevo status code 3 para tiempo mínimo no cumplido
  - Se muestra tiempo restante en minutos cuando no se cumple la validación
  - Se actualizó documentación completa con nuevos parámetros y validaciones


- **11/11/2025 18:12:00**: Adición de ID del parque en función `qrgenerados_obtener_registros_dia`
  - Se agregó columna id_parque para mostrar el ID del parque de la empresa
  - Se obtiene el ID del parque desde la tabla empresas
  - Se mantiene la estructura con una columna de fecha y una de tipo
  - Los registros más recientes aparecen primero en el resultado

- **11/11/2025 18:05:00**: Adición de ID y nombre de empresa en función `qrgenerados_obtener_registros_dia`
  - Se agregó columna id_empresa y nombre_empresa para mostrar datos completos de la empresa
  - Se unieron tablas qrGenerados → qrEmpresas → empresas para obtener los datos
  - Se mantiene la estructura con una columna de fecha y una de tipo
  - Los registros más recientes aparecen primero en el resultado

- **11/11/2025 18:01:00**: Adición de nombre de empresa en función `qrgenerados_obtener_registros_dia`
  - Se agregó columna nombre_empresa para mostrar la empresa del visitante
  - Se unieron tablas qrEmpresas y empresas para obtener el nombre
  - Se mantiene la estructura con una columna de fecha y una de tipo
  - Los registros más recientes aparecen primero en el resultado

- **11/11/2025 17:36:00**: Mejora de ordenamiento en función `qrgenerados_obtener_registros_dia`
  - Se unificaron las consultas con UNION ALL para ordenar globalmente
  - Ahora ordena todos los eventos por fecha_evento DESC
  - Los registros más recientes aparecen primero en el resultado
  - Se mantiene la estructura con una columna de fecha y una de tipo

- **11/11/2025 08:05:00**: Modificación de estructura en función `qrgenerados_obtener_registros_dia`
  - Se cambió de dos columnas (fecEntrada, fecSalida) a una sola (fecha_evento)
  - Se agregó columna tipo_evento que indica 'Entrada' o 'Salida'
  - Ahora genera un registro por cada evento (entrada y/o salida)
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla

- **11/11/2025 08:01:00**: Modificación de filtro en función `qrgenerados_obtener_registros_dia`
  - Se eliminó el filtro de status = true para mostrar todos los registros del día
  - Ahora muestra todos los registros sin importar si están activos o inactivos
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla

- **11/11/2025 07:38:00**: Corrección de tipos de datos en función `qrgenerados_obtener_registros_dia`
  - Se corrigió el tipo de retorno de TIMESTAMPTZ a TIMESTAMP WITHOUT TIME ZONE
  - Se ajustó el filtrado para comparar directamente las fechas sin conversión de zona
  - Ahora muestra las fechas exactamente como están almacenadas en la tabla
  - Se eliminaron conversiones de zona horaria para mostrar datos originales

- **10/11/2025 11:46:00**: Corrección de zona horaria en función `qrgenerados_validar_acceso`
  - Se ajustó el cálculo de fecha y hora para usar explícitamente la zona horaria de México
  - Se corrigió el formato de fecha actual: `(NOW() AT TIME ZONE 'America/Mexico_City')::DATE`
  - Se agregó campo `hora_registro` en la respuesta JSON con timestamp en zona México
  - Se mejoraron los mensajes de error para incluir información de zona horaria

- **10/11/2025**: Creación inicial de las funciones del módulo QRGenerados
  - `qrgenerados_validar_acceso`: Validación de códigos QR y gestión de accesos
  - `qrgenerados_obtener_registros_dia`: Obtención de registros del día actual