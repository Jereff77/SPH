# Tabla: catInmobiliarias

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`catInmobiliarias`](catInmobiliarias/README.md) almacena las diferentes inmobiliarias externas que colaboran con SPH Bines Raices. Cada registro representa una inmobiliaria específica que puede estar asociada a asesores inmobiliarios y leads. Las inmobiliarias se utilizan para gestionar las relaciones con socios externos y rastrear la procedencia de leads.

---

## 📊 Estadísticas

- **Total de registros**: 65
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('catinmobiliarias_id_seq'::regclass)` | Identificador único de la inmobiliaria |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre de la inmobiliaria |
| `codigo` | `text` | Sí | | Código de la inmobiliaria |
| `telefono` | `text` | Sí | | Teléfono de la inmobiliaria |
| `correo` | `text` | Sí | | Correo electrónico de la inmobiliaria |
| `direccion` | `text` | Sí | | Dirección de la inmobiliaria |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `catInmobiliarias`

1. **[`catAsesoresInm`](catAsesoresInm/README.md)**
   - Relación: Cada asesor inmobiliario pertenece a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

2. **[`leads`](leads/README.md)**
   - Relación: Cada lead puede estar asociado a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

3. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar puede estar asociado a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

4. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado puede estar asociado a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`catInmobiliarias`](catInmobiliarias/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`catInmobiliarias`](catInmobiliarias/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Inmobiliarias Externas**: Las inmobiliarias representan socios externos que colaboran con SPH Bines Raices.

2. **Gestión de Relaciones**: Las inmobiliarias se utilizan para gestionar las relaciones con socios externos y rastrear la procedencia de leads.

3. **Asociación con Asesores**: Las inmobiliarias pueden tener asesores inmobiliarios asociados.

4. **Asociación con Leads**: Las inmobiliarias pueden estar asociadas a leads para rastrear la procedencia.

5. **Inmobiliarias Activas**: Solo las inmobiliarias con `status = true` están disponibles para asignación a asesores y leads.

6. **Flexibilidad**: La tabla permite agregar nuevas inmobiliarias según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`catInmobiliarias`](catInmobiliarias/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)

---

## 🚀 Instalación

Para instalar los componentes asociados a la tabla `catInmobiliarias`:

```sql
-- Instalar todas las funciones y triggers
\i catInmobiliarias/funciones y trigger/instalar_todo.sql
```

### Verificar instalación

```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%catinmobiliarias%' AND routine_schema = 'public';
```
