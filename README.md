# Documentación de Funciones y Triggers - Proyecto supaSPH-QR

Este directorio contiene la documentación completa de todas las funciones y triggers del proyecto supaSPH-QR, organizados por tablas y módulos.

## 📁 Estructura de Carpetas

```
├── catUsers/                    # Gestión de usuarios
│   └── funciones y trigger/
├── segModulos/                  # Seguridad y módulos
│   └── funciones y trigger/
├── empresasNaves/               # Relación empresas-naves
│   └── funciones y trigger/
├── naves/                       # Gestión de naves
│   └── funciones y trigger/
├── empresas/                    # Gestión de empresas
│   ├── funciones y trigger/
│   └── vistas/
├── invitaciones/                # Sistema de invitaciones
│   └── funciones y trigger/
├── imagen/                      # Generación de imágenes con IA
├── QRGenerados/                 # Sistema de control de accesos
│   └── funciones y trigger/
│   ├── generar_imagen_kling_ai.py
│   ├── instalar_todo.py
│   ├── requirements.txt
│   ├── .env
│   ├── .gitignore
│   └── README.md
├── funciones generales/         # Funciones de utilidad
└── instalar_todo_general.sql    # Instalación completa
```

## 🚀 Instalación

### Instalación Completa (Recomendado)
Ejecutar el script maestro para instalar todos los componentes:
```sql
\i instalar_todo_general.sql
```

### Instalación Individual
También es posible instalar por módulos usando los scripts `instalar_todo.sql` de cada carpeta. Las vistas tienen instalación individual en sus carpetas correspondientes.

## 📊 Resumen de Componentes

### catUsers (Gestión de Usuarios)
- **Funciones**: 5
  - `catusers_actualizar_nivel_desde_perfil()` - Sincronización de niveles
  - `catusers_llenar_nomcompleto()` - Generación automática de datos
  - `catusers_marcar_invitacion_usada()` - Marcar invitaciones como usadas
  - `catusers_validar_insercion()` - Validación de inserción
  - `validar_permiso_usuario()` - Validación de permisos
- **Triggers**: 3
  - `trigger_catusers_actualizar_nivel_desde_perfil`
  - `trigger_catusers_llenar_nomcompleto`
  - `trigger_catusers_marcar_invitacion_usada`

### segModulos (Seguridad)
- **Funciones**: 1
  - `segmodulos_agregar_todos_usuarios()` - Asignación automática de módulos
- **Triggers**: 1
  - `trigger_segmodulos_auto_asignar`

### empresasNaves (Relación)
- **Funciones**: 1
  - `empresasnaves_insertar_desde_naves()` - Poblado inicial
- **Triggers**: 1
  - `trigger_naves_asignadas_sync`

### naves (Gestión)
- **Funciones**: 2
  - `naves_asignadas_sync_trigger()` - Sincronización de asignación
  - `naves_buscar_disponibles()` - Búsqueda de naves disponibles
- **Políticas RLS**: 1
  - `naves_ver_parques_asignados` - Filtra naves por parques asignados al usuario

### empresas (Gestión)
- **Funciones**: 2
  - `v_resumenempresas_buscar()` - Búsqueda filtrada de empresas
  - `v_resumenempresas_buscar_por_id()` - Búsqueda por ID con filtrado de naves por permisos de usuario
- **Vistas**: 1
  - `v_resumenempresas` - Resumen completo de empresas con estadísticas y naves asignadas

### invitaciones (Sistema)
- **Funciones**: 1
  - `validar_invitacion()` - Validación completa de invitaciones

### QRGenerados (Control de Accesos)
- **Funciones**: 2
  - `qrgenerados_validar_acceso()` - Validación de códigos QR y gestión de accesos con validación de tiempo
  - `qrgenerados_obtener_registros_dia()` - Obtención de registros del día actual
- **Características**:
  - Validación de códigos QR con clave de 15 caracteres
  - Gestión automática de entrada/salida
  - Validación de tiempo mínimo de 5 minutos entre entrada y salida
  - Consideración explícita de zona horaria de México (America/Mexico_City)
  - Integración con datos de visitantes
  - Filtrado inteligente de registros del día
  - Mensajes detallados sobre el resultado de la validación
  - Estados: 0=inválido, 1=entrada, 2=salida, 3=tiempo mínimo no cumplido, 4=usado
  - Campo `hora_registro` en respuesta con timestamp en zona horaria de México
  - Mensaje informativo con tiempo restante cuando no se cumple la validación de tiempo

### funciones generales (Utilidad)
- **Funciones**: 1
  - `cdg()` - Consultas seguras encriptadas

### imagen (Generación de Imágenes)
- **Scripts**: 6
  - `generar_imagen_kling_ai.py` - Generador de imágenes con KLING AI
  - `instalar_todo.py` - Instalador de dependencias y configuración
  - `requirements.txt` - Dependencias del proyecto
  - `.env` - Credenciales de API (excluido del control de versiones)
  - `.gitignore` - Archivos ignorados por Git
  - `README.md` - Documentación del módulo
- **Características**:
  - Generación de imágenes a partir de descripciones textuales
  - Interfaz de línea de comandos fácil de usar
  - Guardado automático de imágenes y respuestas
  - Soporte para diferentes modos (standard/pro)
  - Soporte para diferentes estilos (fotográfico/animado/pintura)
  - Sistema seguro de credenciales con archivo .env

## 🔐 Seguridad

- **SECURITY DEFINER**: Funciones que necesitan permisos elevados
  - `catusers_marcar_invitacion_usada`
  - `catusers_validar_insercion`
  - `validar_invitacion`
  - `segmodulos_agregar_todos_usuarios`
- **SECURITY INVOKER**: Resto de funciones (por defecto)
- **Validaciones**: Todas las funciones incluyen validaciones de negocio

## 🔄 Flujo de Sincronización

```
empresasNaves ↔ naves
    ↓ (trigger_naves_asignadas_sync)
naves_asignadas_sync_trigger()
    ↓
Actualización automática de:
- asignado (true/false)
- idEmpresa (uuid/NULL)
- uidAsignador (uuid/NULL)
```

## 📋 Características Principales

### Automatización
- Sincronización automática entre tablas relacionadas
- Generación automática de datos (UUID, nombres completos)
- Actualización automática de niveles según perfiles

### Seguridad
- Sistema de invitaciones con validación completa
- Consultas seguras encriptadas (CDG)
- Validación de permisos por usuario y módulo

### Búsqueda y Filtrado
- Búsqueda flexible de empresas con múltiples criterios
- Búsqueda de naves disponibles para asignación
- Búsqueda por nombre o número de nave
- Vistas materializadas para reportes y paneles de control

### Consistencia
- Sincronización unidireccional para evitar bucles
- Validaciones de integridad referencial
- Manejo de casos límite y errores

## 📝 Convenciones

- **Nomenclatura**:
  - Funciones: `tabla_funcion_descripcion`
  - Triggers: `trigger_tabla_accion`
  - Vistas: `v_nombrevista`
- **Documentación**: Todas las componentes incluyen documentación completa
- **Seguridad**: Nombres con mayúsculas usan comillas dobles
- **Organización**: Cada componente en su propio archivo SQL

## 🛠 Mantenimiento

Para agregar nuevas funciones, triggers o vistas:
1. Crear archivo SQL apropiado en la carpeta correspondiente
2. Incluir documentación completa
3. Actualizar script de instalación si es necesario
4. Actualizar este README con el nuevo componente
5. Las vistas se ubican en subcarpeta `vistas/` dentro de la tabla principal

## 📝 Registro de Cambios

### 17/10/2025
- **Modificación**: Vista `v_resumenempresas`
- **Cambio**: Se agregó la columna `navesAsignadas` con array JSON de objetos (idNave, numNaveNombre) de naves asignadas a cada empresa
- **Impacto**: Mejora la visualización de naves asignadas en el panel de control de empresas
- **Archivos modificados**:
  - `empresas/vistas/v_resumenempresas.sql`
  - `empresas/vistas/README.md`
  - `empresas/vistas/instalar_todo.sql`
  - `README.md` (general)

- **Nueva Función**: `v_resumenempresas_buscar_por_id()`
- **Cambio**: Se creó función para búsqueda por ID con filtrado de naves según permisos de usuario
- **Impacto**: Permite consultar empresas con naves filtradas por parques accesibles del usuario actual
- **Archivos modificados/creados**:
  - `empresas/funciones y trigger/v_resumenempresas_buscar_por_id.sql` (nuevo)
  - `empresas/funciones y trigger/instalar_todo.sql` (nuevo)
  - `empresas/funciones y trigger/README.md`
  - `README.md` (general)

- **Actualización**: Vista y función `v_resumenempresas`
- **Cambio**: Se modificó la estructura de `navesAsignadas` para incluir idNave, numNaveNombre, idParque y nombreParque en objetos JSON
- **Impacto**: Proporciona información completa de las naves asignadas incluyendo datos del parque
- **Archivos modificados**:
  - `empresas/vistas/v_resumenempresas.sql`
  - `empresas/funciones y trigger/v_resumenempresas_buscar_por_id.sql`
  - `empresas/vistas/README.md`

- **Nueva Política RLS**: `naves_ver_parques_asignados`
- **Cambio**: Se creó política de seguridad para tabla naves que filtra por parques asignados al usuario
- **Impacto**: Los usuarios solo pueden ver naves de los parques a los que tienen acceso, usuarios anónimos no ven nada
- **Archivos modificados/creados**:
  - `naves/politicas_rls.sql` (nuevo)
  - `naves/README.md` (nuevo)
  - `instalar_todo_general.sql`

### 19/10/2025
- **Nueva Carpeta**: `imagen/`
- **Cambio**: Se creó módulo completo para generación de imágenes con IA
- **Impacto**: Permite generar imágenes utilizando la API de KLING AI
- **Archivos creados**:
  - `imagen/generar_imagen_kling_ai.py` (nuevo)
  - `imagen/instalar_todo.py` (nuevo)
  - `imagen/requirements.txt` (nuevo)
  - `imagen/.env` (nuevo)
  - `imagen/.gitignore` (nuevo)
  - `imagen/README.md` (nuevo)
  - `README.md` (general)

### 11/11/2025 18:01:00
- **Modificación**: Función `qrgenerados_obtener_registros_dia()`
- **Cambio**: Se agregó el nombre de la empresa a la que pertenece el visitante
- **Impacto**: Ahora incluye el nombre de la empresa obtenido desde qrEmpresas y empresas
- **Detalles**:
  - Se agregó columna nombre_empresa al resultado
  - Se unieron tablas qrEmpresas y empresas para obtener el nombre
  - Se mantiene la estructura con una columna de fecha y una de tipo
  - Los registros más recientes aparecen primero en el resultado
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 11/11/2025 17:36:00
- **Modificación**: Función `qrgenerados_obtener_registros_dia()`
- **Cambio**: Se mejoró el ordenamiento para mostrar los eventos más recientes primero
- **Impacto**: Ahora ordena todos los eventos por fecha_evento DESC globalmente
- **Detalles**:
  - Se unificaron las consultas con UNION ALL para ordenar globalmente
  - Se mantiene la estructura con una columna de fecha y una de tipo
  - Los registros más recientes aparecen primero en el resultado
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 11/11/2025 08:05:00
- **Modificación**: Función `qrgenerados_obtener_registros_dia()`
- **Cambio**: Se modificó la estructura para mostrar una columna de fecha y una de tipo de evento
- **Impacto**: Ahora genera un registro por cada evento (entrada o salida) del día
- **Detalles**:
  - Se cambió de dos columnas (fecEntrada, fecSalida) a una sola (fecha_evento)
  - Se agregó columna tipo_evento que indica 'Entrada' o 'Salida'
  - Se eliminó el filtro de status para mostrar todos los registros del día
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 11/11/2025 08:01:00
- **Modificación**: Función `qrgenerados_obtener_registros_dia()`
- **Cambio**: Se eliminó el filtro de status para mostrar todos los registros del día
- **Impacto**: Ahora muestra todos los registros del día sin importar si están activos o inactivos
- **Detalles**:
  - Se eliminó la condición `AND qr."status" = true` del WHERE
  - Ahora muestra todos los registros que tengan entrada o salida en el día actual
  - Se mantiene el tipo de dato TIMESTAMP WITHOUT TIME ZONE para coincidir con tabla
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 11/11/2025 07:38:00
- **Modificación**: Función `qrgenerados_obtener_registros_dia()`
- **Cambio**: Se corrigieron los tipos de datos para coincidir con la estructura de la tabla
- **Impacto**: Ahora muestra las fechas exactamente como están almacenadas en la tabla (sin zona horaria)
- **Detalles**:
  - Se cambió el tipo de retorno de TIMESTAMPTZ a TIMESTAMP WITHOUT TIME ZONE
  - Se eliminaron conversiones de zona horaria en el filtrado
  - Ahora compara directamente las fechas con CURRENT_DATE
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 10/11/2025 11:46:00
- **Modificación**: Función `qrgenerados_validar_acceso()`
- **Cambio**: Se corrigió el manejo de zona horaria para usar siempre la zona horaria de México
- **Impacto**: Ahora todas las operaciones de fecha/hora usan explícitamente `AT TIME ZONE 'America/Mexico_City'`
- **Detalles**:
  - Se ajustó el cálculo de fecha actual: `(NOW() AT TIME ZONE 'America/Mexico_City')::DATE`
  - Se agregó campo `hora_registro` en la respuesta JSON con timestamp en zona México
  - Se mejoraron los mensajes para mostrar horas en zona horaria correcta
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)

### 10/11/2025
- **Nueva Carpeta**: `QRGenerados/`
- **Cambio**: Se creó módulo completo para control de accesos mediante códigos QR
- **Impacto**: Permite validar códigos QR, registrar entradas/salidas y gestionar accesos de visitantes
- **Archivos creados**:
  - `QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql` (nuevo)
  - `QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql` (nuevo)
  - `QRGenerados/funciones y trigger/instalar_todo.sql` (nuevo)
  - `QRGenerados/funciones y trigger/README.md` (nuevo)
  - `QRGenerados/README.md` (nuevo)
  - `README.md` (general)

### 01/12/2025 17:01:00
- **Modificación**: Función `qrgenerados_validar_acceso()`
- **Cambio**: Se agregó validación de tiempo mínimo entre entrada y salida
- **Impacto**: Ahora requiere un mínimo de 5 minutos entre entrada y salida para evitar registros duplicados por escaneo accidental
- **Detalles**:
  - Se agregó validación de 5 minutos mínimos entre entrada y salida
  - Nuevo status code 3 para tiempo mínimo no cumplido
  - Se muestra tiempo restante en minutos cuando no se cumple la validación
  - Se mantiene la lógica existente para la entrada
  - Se actualizó documentación completa con nuevos parámetros y validaciones
- **Archivos modificados**:
  - `QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql`
  - `QRGenerados/funciones y trigger/README.md`
  - `QRGenerados/funciones y trigger/instalar_todo.sql`
  - `README.md` (general)