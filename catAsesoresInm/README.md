# Tabla: catAsesoresInm

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`catAsesoresInm`](catAsesoresInm/README.md) almacena los diferentes asesores inmobiliarios externos que colaboran con SPH Bines Raices. Cada registro representa un asesor inmobiliario específico que pertenece a una inmobiliaria y puede estar asociado a leads. Los asesores inmobiliarios se utilizan para gestionar las relaciones con colaboradores externos y rastrear la procedencia de leads.

---

## 📊 Estadísticas

- **Total de registros**: 1
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('catacesoresinm_id_seq'::regclass)` | Identificador único del asesor inmobiliario |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del asesor inmobiliario |
| `codigo` | `text` | Sí | | Código del asesor inmobiliario |
| `telefono` | `text` | Sí | | Teléfono del asesor inmobiliario |
| `correo` | `text` | Sí | | Correo electrónico del asesor inmobiliario |
| `idInmobiliaria` | `integer` | Sí | | Inmobiliaria a la que pertenece (FK a catInmobiliarias) |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `idInmobiliaria` | `catInmobiliarias` | `id` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `catAsesoresInm`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead puede estar asociado a un asesor inmobiliario
   - Campo: `idAsesorInm` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar puede estar asociado a un asesor inmobiliario
   - Campo: `idAsesorInm` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado puede estar asociado a un asesor inmobiliario
   - Campo: `idAsesorInm` → `id`

### Tablas Referenciadas por `catAsesoresInm`

1. **[`catInmobiliarias`](catInmobiliarias/README.md)**
   - Relación: Cada asesor inmobiliario pertenece a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `catAsesoresInm`

1. **[`catasesoresinm_validar_telefono`](funciones y trigger/catasoresinm_validar_telefono.sql)**
   - **Descripción**: Validar teléfono de asesor inmobiliario
   - **Parámetros**: `p_id` (integer), `p_telefono` (text)
   - **Retorno**: JSON con resultado de la validación
   - **Validaciones**:
     - Verifica si el teléfono ya existe en otro asesor inmobiliario
     - Retorna error si hay duplicado

2. **[`catasesoresinm_obtener_por_codigo`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Obtener asesor inmobiliario por código
   - **Parámetros**: `p_codigo` (text)
   - **Retorno**: TABLE con todos los campos de la tabla
   - **Uso**: Para buscar un asesor inmobiliario específico por su código

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`catAsesoresInm`](catAsesoresInm/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Asesores Inmobiliarios Externos**: Los asesores inmobiliarios representan colaboradores externos que trabajan con inmobiliarias asociadas.

2. **Gestión de Relaciones**: Los asesores inmobiliarios se utilizan para gestionar las relaciones con colaboradores externos y rastrear la procedencia de leads.

3. **Pertenencia a Inmobiliarias**: Los asesores inmobiliarios pertenecen a una inmobiliaria específica.

4. **Asociación con Leads**: Los asesores inmobiliarios pueden estar asociados a leads para rastrear la procedencia.

5. **Asesores Inmobiliarios Activos**: Solo los asesores inmobiliarios con `status = true` están disponibles para asignación a leads.

6. **Flexibilidad**: La tabla permite agregar nuevos asesores inmobiliarios según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`catAsesoresInm`](catAsesoresInm/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)

---

## 🚀 Instalación

Para instalar los componentes asociados a la tabla `catAsesoresInm`:

```sql
-- Instalar todas las funciones y triggers
\i catAsesoresInm/funciones y trigger/instalar_todo.sql
```

### Verificar instalación

```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%catasesoresinm%' AND routine_schema = 'public';
```
