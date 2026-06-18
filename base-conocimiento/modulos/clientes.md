---
modulo: Clientes
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-18
submodulos: [Listado, Alta/Edición, Papelera]
rutas: [/clientes]
claves_permiso: [300]
tablas: [inversionista]
palabras_clave: [cliente, clientes, inversionista, arrendatario, ticket, usuario final, papelera, prueba, razón social, RFC, CURP, contpaq, personalidad, persona física, persona moral, alta cliente, editar cliente, CRM]
relacionado_con: [inversionistas, arrendatarios]
---

# Módulo: Clientes

## 1. Identificación
- **Propósito:** alta, edición y consulta del **padrón de clientes** (tabla `inversionista`). Un mismo
  cliente puede ser **inversionista**, **arrendatario**, **ticket** y/o **usuario final** a la vez.
- **Ruta / permiso:** **`/clientes`** · clave **300**. Es una **sección directa** del sidebar (no tiene
  submenú: el ítem "Clientes" entra directo).
- **Origen:** migra la pantalla "Clientes" del módulo **CRM** de v1 (`i07_c_r_m/clientes`). En v2 se llama
  simplemente **Clientes** (el resto del CRM —leads, pipeline, inmobiliarias, soporte— no está migrado).

## 2. Pantalla (`/clientes`)
- **Chips de tipo** (1 activo): **Inversionistas** (`inversionista=true`), **Arrendatarios**
  (`arrendatario=true`), **Ticket** (`ticket=true`), **Usuario Final** (`usuarioFinal=true`) y **Papelera**.
  - *Papelera* = `pruebas=true` **o** sin ningún tipo asignado (`inversionista=false AND arrendatario=false
    AND ticket=false`), tal como v1.
- **Buscador** (texto libre): filtra por nombre, razón social, RFC, CURP, correo y teléfono.
- **Tabla** (encabezado azul sticky, columnas ordenables): **Opciones · Personalidad · idContpac · Razón
  Social · Nombre · Apellido 1 · Apellido 2 · Fecha nac. · Teléfono · Correo · RFC · CURP**. Ordenada por
  razón social. Sin paginación (volúmenes chicos, ~380 registros).
- **Acciones por fila:** **✏️ Editar** (abre el formulario) y **🗑 Mover a papelera**.
- **Botón "+ Agregar nuevo":** abre el formulario de alta (con el tipo del chip activo pre-marcado).

## 3. Formulario de alta/edición (`ClienteModal`)
Campos: **Personalidad** (Física/Moral), Nombre*, Razón social, Primer/Segundo apellido, Fecha de
nacimiento, Teléfono, Correo, Contpaq ID, RFC, CURP, y **casillas de tipo** (Inversionista / Arrendatario /
Ticket / Usuario final). *Nombre es obligatorio.* Escribe en `inversionista` (alta genera `idInversionista`
y fija `idUser`, `status=true`, `pruebas=false`).

## 4. Mover a la papelera
Replica v1: `pruebas=true`, `tipoCliente='0001'`, y apaga todas las banderas de tipo
(`inversionista/arrendatario/ticket/usuarioFinal = false`). No borra el registro (queda en la Papelera).

## 5. Endpoints (backend, `@Controller('clientes')`, clave 300)
- `GET /clientes?tipo=` — listado por chip (`inversionistas|arrendatarios|ticket|usuarioFinal|papelera`).
- `POST /clientes` — alta.
- `PATCH /clientes/:id` — edición.
- `POST /clientes/:id/papelera` — mover a la papelera.

## 6. Seguridad
- `JwtAuthGuard + PermisoGuard` con `@RequierePermiso(300)`. Escrituras auditadas (`comoActor`), bloqueadas
  en modo "Ver como" (no-soporte). El frontend nunca habla con Supabase.

## 7. Relación con otros módulos
- **Inversionistas/Propietarios (Ventas):** misma tabla `inversionista`. Los clientes marcados como
  `inversionista=true` (y `pruebas=false`) con propiedad activa son los que aparecen en **Ventas → Planes**.
- **Arrendatarios:** el mismo registro funge como arrendatario cuando `arrendatario=true`.

## 8. Pendiente / fuera del MVP
- Restaurar desde la papelera (hoy solo se mueve hacia la papelera). Campos fiscales avanzados (régimen,
  uso CFDI, empresa). El resto del **CRM** de v1 (leads, pipeline, carteras, inmobiliarias, asesores,
  soporte) no está migrado.

## 9. Normalización de `personalidad` + razón social de físicas (trigger BD, 2026-06-18)
- **Regla de negocio (replica v1):** una persona **física** no está obligada a tener razón social; su
  `razonsocial` se **formula automáticamente** con el nombre completo (`UPPER(nombre + apellido1 +
  apellido2)`). Una persona **moral** conserva la razón social que captura el usuario.
- **Implementación:** trigger de BD `v2_trg_inversionista_razonsocial` (función
  `v2_inversionista_set_razonsocial()`) **BEFORE INSERT/UPDATE** sobre `inversionista`. Se eligió un
  trigger —no lógica de backend— para cubrir en un solo lugar **todos** los flujos que escriben en
  `inversionista`: Clientes, **Ventas/Planes**, **Fideicomiso** y también **v1** (Flutter, aún activo).
  DDL versionado en `base-conocimiento/migraciones/2026-06-18-inversionista-autocompleta-razonsocial-fisica.sql`.
- **Detección de física:** `personalidad ILIKE 'f%'` (los datos traían `"Fisica"` y `"Física"`).
- **Normalización de `personalidad` (canónico `'Fisica'` / `'Moral'`, SIN acento):** el mismo trigger
  canoniza el valor en cada INSERT/UPDATE. ⛔ **No usar acento** en el dato: **v1 (activo)** usa el literal
  `'Fisica'` en sus dropdowns (`options: ['Fisica','Moral']`) y en comparaciones de lógica
  (`== 'Fisica'`), por lo que `"Física"` rompería su selección y sus condicionales (regla de coexistencia).
  La **UI puede mostrar "Física"** como etiqueta, pero el **value almacenado es `'Fisica'`** (así quedó el
  dropdown de `ClienteModal.tsx`: `<option value="Fisica">Física</option>`). Saneo aplicado: las 3
  `"Física"` → `"Fisica"`. (Cuando v1 se retire, se podría migrar a `"Física"` con acento.)
- **Por qué importaba (síntoma origen):** el selector de **clientes para Devolución** de CxP
  (`SolicitudesService.inversionistas`) filtra `razonsocial IS NOT NULL` y muestra esa columna; las físicas
  sin razón social (p. ej. *Mauricio Valdez Salgado*) **no aparecían**. Con el trigger + el saneo de datos
  (físicas activas con `razonsocial` vacía → su nombre) ya aparecen, sin tocar el código del selector.
