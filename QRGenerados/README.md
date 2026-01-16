# QRGenerados - Sistema de Control de Accesos

## 📋 Descripción General

La tabla `qrGenerados` es el componente central del sistema de control de accesos, encargado de gestionar los códigos QR generados para autorizar el ingreso y egreso de visitantes a las instalaciones.

## 🏗️ Estructura de la Tabla

### Campos Principales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idQR` | UUID | Identificador único del código QR |
| `claveAcceso` | text(15) | Clave única de acceso (15 caracteres) |
| `status` | boolean | Estado activo/inactivo del código |
| `vigencia` | boolean | Vigencia del código para uso |
| `fechaValidez` | date | Fecha en que el código es válido |
| `fecEntrada` | timestamptz | Fecha/hora de registro de entrada |
| `fecSalida` | timestamptz | Fecha/hora de registro de salida |
| `idVisitante` | UUID | Relación con datos del visitante |
| `tipoVehiculo` | text | Tipo de vehículo del visitante |
| `placasVehiculo` | text | Placas del vehículo |
| `limiteUsos` | integer | Límite de usos permitidos |
| `usos` | integer | Contador de usos realizados |
| `estado` | integer | Estado del proceso (1=Pendiente, 2=En uso, 3=Terminada) |

## 📁 Estructura de Carpetas

```
QRGenerados/
├── funciones y trigger/          # Funciones y triggers asociados
│   ├── qrgenerados_validar_acceso.sql
│   ├── instalar_todo.sql
│   └── README.md
└── README.md                     # Este archivo
```

## 🔄 Flujo de Procesamiento

### Ciclo de Vida de un Código QR

1. **Generación**: Se crea un código QR con fecha de validez específica
2. **Validación**: El sistema verifica existencia, vigencia y fecha
3. **Entrada**: Primer uso - registra fecEntrada
4. **Salida**: Segundo uso - registra fecSalida y desactiva código
5. **Finalización**: Código marcado como utilizado completamente

### Estados del Sistema

| Estado | fecEntrada | fecSalida | status | Descripción |
|--------|------------|-----------|---------|-------------|
| Pendiente | NULL | NULL | true | Código listo para primer uso |
| En uso | NOT NULL | NULL | true | Entrada registrada, esperando salida |
| Terminada | NOT NULL | NOT NULL | false | Código completamente utilizado |

## 🔧 Componentes Disponibles

### Funciones

#### `qrgenerados_validar_acceso(clave_acceso: text) → jsonb`

Función principal para validar códigos QR y gestionar accesos.

**Parámetros:**
- `clave_acceso`: Clave de 15 caracteres a validar

**Retorno:**
```json
{
  "status": 0|1|2|4,
  "nombre": "string",
  "placas": "string",
  "tipo_vehiculo": "string",
  "urlIdentificacion": "string",
  "mensaje": "string",
  "exito": boolean,
  "fecha_hora": "DD/MM/YYYY HH24:MI:SS"
}
```

**Códigos de Estado:**
- `0`: Código inválido (no existe, inactivo, fecha incorrecta)
- `1`: Entrada registrada exitosamente
- `2`: Salida registrada exitosamente
- `4`: Código ya utilizado (ambas fechas registradas)

**Mensajes Detallados:**
- `"Código de acceso no encontrado o inactivo"` - Clave no existe o está desactivada
- `"Código de acceso no vigente"` - El código perdió su vigencia
- `"Código no válido para la fecha actual (DD/MM/YYYY)"` - Fecha diferente a la de validez
- `"Código ya fue utilizado completamente (entrada: DD/MM/YYYY HH24:MI, salida: DD/MM/YYYY HH24:MI)"` - Código ya usado
- `"Entrada registrada exitosamente a las HH24:MI:SS"` - Primera vez que se usa
- `"Salida registrada exitosamente a las HH24:MI:SS"` - Segunda vez que se usa

#### `qrgenerados_obtener_registros_dia() → TABLE`

Función para obtener todos los registros de accesos del día actual.

**Parámetros:** No requiere parámetros

**Retorno:** Tabla con los siguientes campos:
- `id_qr` (UUID): Identificador del registro
- `clave_acceso` (TEXT): Clave de acceso de 15 caracteres
- `nombre_visitante` (TEXT): Nombre completo del visitante
- `placas_vehiculo` (TEXT): Placas del vehículo
- `tipo_vehiculo` (TEXT): Tipo de vehículo
- `fec_entrada` (TIMESTAMPTZ): Fecha/hora de entrada
- `fec_salida` (TIMESTAMPTZ): Fecha/hora de salida
- `estado` (INTEGER): Estado del proceso
- `url_identificacion` (TEXT): URL de identificación

**Características:**
- Filtra registros donde entrada o salida sean del día actual
- Considera zona horaria de México para el filtrado
- Incluye registros con solo entrada o solo salida del día
- Ordena por fecha más reciente

## 🌍 Consideraciones de Zona Horaria

Todas las operaciones de fecha/hora se realizan considerando la **zona horaria de México (UTC-6)**, asegurando consistencia en los registros de acceso independientemente de la ubicación del servidor.

## 🔐 Seguridad y Políticas RLS

- La tabla está protegida por políticas RLS (Row Level Security)
- Solo usuarios autenticados pueden acceder a los códigos QR
- Las funciones utilizan `SECURITY INVOKER` para respetar permisos
- Los datos de visitantes están protegidos y solo accesibles por personal autorizado

## 📊 Relaciones con Otras Tablas

### Relaciones Directas
- **datosVisitantes**: Información completa del visitante
- **qrEmpresas**: Configuración de códigos por empresa
- **qrUsos**: Registro detallado de usos del código

### Relaciones Indirectas
- **catUsers**: Usuarios que generan códigos
- **empresas**: Empresas asociadas a los códigos

## 🚀 Instalación y Configuración

### Instalación de Componentes

```sql
-- Ejecutar script de instalación
\i QRGenerados/funciones y trigger/instalar_todo.sql
```

### Verificación de Funcionamiento

```sql
-- Probar función de validación
SELECT qrgenerados_validar_acceso('CLAVE_EJEMPLO_15');
```

## 📈 Estadísticas y Monitoreo

### Métricas Clave
- Códigos generados por día
- Tiempo promedio entre entrada y salida
- Códigos no utilizados (vencidos)
- Frecuencia de uso por tipo de vehículo

### Consultas Útiles

```sql
-- Códigos vigentes para hoy
SELECT COUNT(*) FROM "qrGenerados"
WHERE "fechaValidez" = CURRENT_DATE
AND "status" = true AND "vigencia" = true;

-- Visitantes en instalaciones (entrada sin salida)
SELECT COUNT(*) FROM "qrGenerados"
WHERE "fecEntrada" IS NOT NULL
AND "fecSalida" IS NULL;

-- Obtener todos los registros del día actual
SELECT * FROM qrgenerados_obtener_registros_dia();

-- Contar accesos del día actual
SELECT COUNT(*) FROM qrgenerados_obtener_registros_dia();

-- Visitantes que ingresaron hoy
SELECT * FROM qrgenerados_obtener_registros_dia()
WHERE fec_entrada IS NOT NULL;

-- Visitantes que salieron hoy
SELECT * FROM qrgenerados_obtener_registros_dia()
WHERE fec_salida IS NOT NULL;
```

## 📝 Notas Importantes

1. **Longitud de Clave**: Todas las claves de acceso deben tener exactamente 15 caracteres
2. **Unicidad**: Las claves son únicas en todo el sistema
3. **Desactivación Automática**: Los códigos se desactivan después del segundo uso
4. **Manejo de Errores**: La función de validación siempre retorna un JSON válido

## 🔄 Actualizaciones y Mantenimiento

### Registro de Cambios

- **10/11/2025**: Creación inicial del sistema de control de accesos
  - Implementación de función `qrgenerados_validar_acceso`
  - Implementación de función `qrgenerados_obtener_registros_dia`
  - Documentación completa del sistema
  - Scripts de instalación automatizada

### Próximas Mejoras

- [ ] Implementar límite de usos configurable
- [ ] Agregar registro de auditoría detallado
- [ ] Crear vistas de reportes automáticos
- [ ] Implementar notificaciones de accesos

## 📞 Soporte

Para cualquier issue o mejora relacionada con el sistema QRGenerados, contactar al equipo de desarrollo con:

1. Descripción detallada del problema
2. Mensajes de error (si aplica)
3. Pasos para reproducir el issue
4. Impacto en la operación del sistema