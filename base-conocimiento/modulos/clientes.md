---
modulo: Clientes
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-07
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
