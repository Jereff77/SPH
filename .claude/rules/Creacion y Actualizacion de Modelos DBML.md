- ✅ Manejo de **columnas generadas** (con fórmula en comentario y tipo explícito)  
- ✅ Manejo de **columnas autoincrementales** (`IDENTITY` / `SERIAL`)  
- ✅ Creación y actualización incremental  
- ✅ Template listo para usar  

Todo en formato Markdown, lista para incluir en tu repositorio.

---

# 📐 Guía: Creación y Actualización de Modelos DBML

Esta guía define cómo **crear desde cero** o **actualizar de forma segura** la documentación de la estructura de la base de datos en **formato DBML (Database Markup Language)**. El objetivo es garantizar un modelo **preciso, mantenible y alineado con la base de datos real**, respetando el trabajo previo cuando exista.

---

## 🎯 Principios generales

- **Precisión sobre automatización**: mejor poca información exacta que mucha información asumida.
- **Conservación**: si ya existe un modelo, se actualiza; no se reemplaza.
- **Claridad**: el DBML debe ser legible para humanos y compatible con herramientas como [dbdiagram.io](https://dbdiagram.io).
- **Separación de preocupaciones**: el DBML modela **estructura**, no lógica (funciones, RLS, reglas de negocio).

---

## 🆕 Caso 1: Creación inicial (cuando **no existe** el archivo DBML)

### Paso 1: Recopilar datos completos
Obtén de la base de datos:
- Lista de tablas y sus columnas (con tipo, nulabilidad, default).
- Claves primarias.
- Claves foráneas (con tabla y columna destino).
- Tipos `ENUM` personalizados.
- Comentarios en columnas (vía `pg_description`).
- **Fórmulas de columnas generadas**.
- **Tipo de generación de PKs** (`IDENTITY`, `SERIAL`, `UUID`, etc.).

> 🔍 **Herramienta útil**:  
> Usa consultas en `information_schema` y `pg_catalog` (ver anexo).

### Paso 2: Validar integridad
- Asegúrate de que **toda tabla referenciada en una FK exista** en los datos.
- Si falta una tabla (ej. `inversionista`), **no la inventes**. Pide los datos completos.

### Paso 3: Generar el modelo
- Declara primero los `Enum`.
- Luego, las tablas en orden alfabético (recomendado) o por dependencias.
- Aplica las [reglas de formato](#-reglas-de-formato-comunes-a-ambos-casos).

### Paso 4: Validar
- Pega el DBML en [dbdiagram.io](https://dbdiagram.io).  
  → Debe cargar sin errores.
- Verifica que todas las relaciones aparezcan correctamente.

---

## 🔄 Caso 2: Actualización incremental (cuando **ya existe** el archivo DBML)

### Paso 1: Usa el archivo existente como base
- **Nunca sobrescribas** el archivo completo con una exportación nueva.
- El modelo existente contiene valor: comentarios, ajustes manuales, decisiones de diseño.

### Paso 2: Identifica cambios en la base de datos
Busca:
- Nuevas tablas o columnas
- Cambios de tipo, nulabilidad, default
- Nuevas o eliminadas relaciones
- Nuevos enums
- Cambios en comentarios o fórmulas
- Cambios en claves primarias (ej. de `integer` a `uuid`)

### Paso 3: Aplica cambios de forma incremental
- **Nuevas tablas**: agrégalas al final (o en orden alfabético).
- **Nuevas columnas**: agrégalas al final de su tabla.
- **Columnas generadas**: incluye el **tipo de dato real** y la **fórmula exacta** en comentario.
- **PKs autoincrementales**: usa solo `[pk]` + tipo (`integer` o `bigint`); opcionalmente, comenta.
- **Eliminaciones**: si una columna o tabla ya no existe en la BD, elimínala del DBML.
- **Comentarios**: actualízalos si el significado cambió; presérvalos si siguen siendo válidos.

### Paso 4: Preserva el estilo existente
- No reordenes columnas arbitrariamente.
- Sigue el formato de comentarios existente.

### Paso 5: Valida el resultado
- Asegúrate de que el DBML siga siendo válido.
- Confirma que los cambios reflejen **exactamente** la estructura actual.

---

## 📏 Reglas de formato comunes a ambos casos

| Elemento | Regla |
|--------|------|
| **Nombres con mayúsculas** | Siempre entre comillas: `"idArrePdp"` |
| **Tipos** | Usa mapeo estándar: `double precision` → `double`, `numeric(p,s)` → `numeric(p,s)`, etc. |
| **PK** | `[pk]` |
| **NOT NULL** | `[not null]` |
| **Default** | `[default: valor]` (con `` `now()` `` para funciones) |
| **Comentarios** | `// al final de la línea` |
| **FK** | `[ref: < "tabla"."columna"]` |
| **Enums** | Declara como `Enum "public"."nombre" { ... }` y usa como tipo |
| **Columnas generadas** | Incluye el **tipo de dato real** y la **fórmula exacta**: <br> `"fecFin" date // Generada: ("fecInicio" + (plazo * '1 month'::interval))` |
| **PK autoincremental** (`SERIAL`/`IDENTITY`) | Usa solo el tipo (`integer`, `bigint`) + `[pk]`. <br> Opcional: `// Auto-generado` |
| **Exclusiones** | No incluyas: vistas, triggers, RLS, funciones, índices, `CHECK`, `[identity]`, `[serial]` |

> ⚠️ **Importante**:  
> - **`[identity]` no es válido en DBML** → causa errores de sintaxis.  
> - La herramienta de visualización no necesita saber el mecanismo de generación de PK, solo que es clave primaria.

---

## 🛑 Qué **nunca** hacer

- ❌ Usar `[identity]`, `[serial]`, `[autoincrement]` → **no son sintaxis DBML**.
- ❌ Asimilar estructura que no está en los metadatos.
- ❌ Reemplazar un archivo existente sin revisión manual.
- ❌ Eliminar comentarios sin justificación.
- ❌ Incluir lógica de negocio en el modelo DBML.

---

## ✅ Buenas prácticas

- Guarda el DBML en `docs/dbml/schema.dbml`.
- Incluye en el `README.md` un enlace al diagrama generado en [dbdiagram.io](https://dbdiagram.io).
- Documenta reglas de negocio, RLS y funciones en archivos separados.
- Usa commits atómicos:  
  `feat(dbml): añade tabla 'PresCategorias'`  
  `fix(dbml): corrige tipo de 'precioM2' a double en arrePdp`

---

## 📎 Anexo: Consultas útiles en Supabase

### Obtener columnas con comentarios
```sql
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  pgd.description AS comment
FROM information_schema.columns c
LEFT JOIN pg_statio_all_tables st ON st.schemaname = c.table_schema AND st.relname = c.table_name
LEFT JOIN pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
```

### Obtener FKs (versión robusta)
```sql
SELECT
  nsp.nspname AS source_schema,
  cls.relname AS source_table,
  att.attname AS source_column,
  ref_nsp.nspname AS target_schema,
  ref_cls.relname AS target_table,
  ref_att.attname AS target_column,
  con.confdeltype AS delete_rule
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref_cls.relnamespace
JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = ANY(con.confkey)
WHERE nsp.nspname = 'public'
  AND con.contype = 'f'
ORDER BY cls.relname, att.attname;
```

### Obtener fórmulas de columnas generadas
```sql
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  pg_get_expr(ad.adbin, ad.adrelid) AS generation_expr
FROM information_schema.columns c
JOIN pg_attribute a 
  ON a.attname = c.column_name
  AND a.attrelid = (c.table_schema || '.' || c.table_name)::regclass::oid
JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE c.table_schema = 'public'
  AND c.is_generated = 'ALWAYS';
```

---

## 📄 Template inicial: `schema.dbml`

Guarda este contenido en `docs/dbml/schema.dbml` la primera vez:

```dbml
// Modelo lógico de la base de datos
// Generado el: [FECHA]
// Última actualización: [FECHA]
// Fuente: PostgreSQL (Supabase)
// Diagrama: https://dbdiagram.io/d/... (pegar enlace cuando esté listo)

// Enums personalizados
// Enum "public"."mesGratis" {
//   "No"
//   "Si"
//   "Medio"
// }

// Tablas
// Table "public"."ejemploTabla" {
//   "id" integer [pk] // Auto-generado (SERIAL / IDENTITY)
//   "uid" uuid [pk, not null, default: `gen_random_uuid()`]
//   "fc" timestamp [not null, default: `now()`]
//   "status" boolean [default: true]
//   "nombre" text [not null]
//   "monto" double [default: 0]
//   "fecInicio" date
//   "plazo" smallint
//   "fecFin" date // Generada: ("fecInicio" + ((plazo)::double precision * '1 mon'::interval))
//   "idRelacion" text [ref: < "otraTabla"."idColumna"]
//   "descripcion" text // Comentario opcional
// }
```

> 💡 **Instrucciones de uso del template**:  
> 1. Reemplaza los bloques comentados con tus enums y tablas reales.  
> 2. Elimina los comentarios de ejemplo (`// Enum ...`, `// Table ...`) una vez agregues contenido real.  
> 3. Actualiza las fechas y el enlace al diagrama.

---

> 💡 **Recordatorio final**:  
> **El DBML no es un artefacto generado, sino un documento de diseño que se mantiene.**  
> Trátalo con el mismo cuidado que el código fuente.

--- 