# Tabla: seguimientoComentarios

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`seguimientoComentarios`](seguimientoComentarios/README.md) almacena comentarios y notas de seguimiento asociados a leads y clientes en el sistema CRM. Permite mantener un registro detallado de las interacciones, observaciones y decisiones tomadas durante el proceso de ventas, proporcionando un historial completo del seguimiento de cada prospecto.

---

## 📊 Estadísticas

- **Total de registros**: 0
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `idComentario` | `text` | No | | Identificador único del comentario |
| `uidr` | `text` | Sí | | ID del usuario que registró el comentario |
| `status` | `boolean` | Sí | | Estado del registro (activo/inactivo) |
| `fc` | `timestamp without time zone` | No | `now()` | Fecha y hora de creación del comentario |
| `idCliente` | `text` | Sí | | ID del cliente asociado (opcional) |
| `idLead` | `text` | Sí | | ID del lead asociado (opcional) |
| `comentario` | `text` | Sí | | Contenido del comentario o nota de seguimiento |
| `fechaComentario` | `date` | Sí | | Fecha en que se realizó el comentario |

---

## 🔗 Claves Foráneas

Actualmente no hay claves foráneas definidas explícitamente en esta tabla, aunque los campos `idCliente` y `idLead` hacen referencia a otras tablas del sistema.

---

## 🔄 Relaciones con Otras Tablas

### Tablas Relacionadas

1. **[`leads`](leads/README.md)**
   - Relación: Los comentarios pueden estar asociados a leads específicos
   - Campo: `idLead` → `id` (referencia lógica)

2. **Clientes**
   - Relación: Los comentarios pueden estar asociados a clientes específicos
   - Campo: `idCliente` (referencia lógica)

---

## ⚙️ Funciones Asociadas

Actualmente no hay funciones específicas documentadas para esta tabla.

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`seguimientoComentarios`](seguimientoComentarios/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Historial de Seguimiento**: Esta tabla es fundamental para mantener un registro completo de todas las interacciones y observaciones sobre leads y clientes.

2. **Flexibilidad de Asociación**: La tabla permite asociar comentarios tanto a leads como a clientes, proporcionando flexibilidad en el seguimiento.

3. **Registro de Usuario**: El campo `uidr` permite saber qué usuario registró cada comentario, lo cual es útil para auditoría y responsabilidad.

4. **Fecha de Comentario**: El campo `fechaComentario` permite registrar cuándo se realizó la observación, independientemente de la fecha de creación del registro en el sistema.

5. **Estado Actual**: La tabla no tiene registros (0), lo que sugiere que esta funcionalidad podría estar en proceso de implementación o subutilizada.

---

## 📞 Soporte

Para más información sobre la tabla [`seguimientoComentarios`](seguimientoComentarios/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`Leads/Funciones_Leads.md`](Leads/Funciones_Leads.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
