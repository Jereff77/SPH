---
modulo: Clientes
estado: desarrollado
version_doc: 1.4
ultima_actualizacion: 2026-07-04
submodulos: [Vista unificada, Alta/Edición, Papelera, Guardia de papelera, Control de duplicados por RFC]
rutas: [/clientes]
claves_permiso: [300]
tablas: [inversionista, propiedades, pdpDetalle, arrenPropiedades, arrePdp]
palabras_clave: [cliente, clientes, inversionista, arrendatario, ticket, usuario final, papelera, sin clasificar, prueba, no aparece, no me aparece, no aparece en arrendatarios, no aparece en ventas, sin tipo asignado, todos los clientes, vista unificada, columna tipo, paginación, razón social, RFC, CURP, contpaq, personalidad, persona física, persona moral, alta cliente, editar cliente, CRM, duplicado, duplicados, RFC duplicado, RFC genérico, homoclave, verificar RFC, "no me deja mandar a papelera", "no puedo mandar a papelera", "tiene una nave", recursos ligados, desvincular, dependencias, huérfano]
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

## 2. Pantalla (`/clientes`) — vista unificada (rediseño 2026-07-03, v2.54.0)
Una **sola vista con TODO el padrón** (ya no hay "vistas" separadas por tipo). El backend trae todo con
`GET /clientes?tipo=todos` y el front filtra/ordena/pagina en memoria (volumen chico, ~395 registros).
- **Columna "Tipo"** (nueva, con badges de color; un cliente puede tener **varias**):
  - **Papelera** (gris) ⟺ `pruebas=true`.
  - **Sin clasificar** (ámbar) ⟺ `pruebas=false` y ninguna bandera de tipo activa (el caso "no aparece";
    ver §10).
  - **Inversionista** (azul) / **Arrendatario** (verde) / **Ticket** (morado) / **Usuario Final** (teal)
    ⟺ su bandera. Los multi-tipo muestran varios badges.
- **Chips = filtro rápido** (ya NO son vistas excluyentes): **Todos** (activo por defecto), Inversionistas,
  Arrendatarios, Ticket, Usuario Final, Papelera. Un chip fija la selección del **filtro de la columna
  Tipo** (comparten un único estado); "Todos" la limpia.
- **Papelera oculta por defecto, visible al buscar:** en la vista **Todos** (sin búsqueda) NO se muestran
  los `pruebas=true` (para no ensuciar). **En cuanto se escribe en el buscador**, la papelera **sí** se
  incluye (para hallar un extraviado); y el **chip Papelera** también la muestra explícitamente. Los "Sin
  clasificar" (no son papelera) se muestran **siempre**.
- **Buscador** (texto libre): filtra por nombre, razón social, RFC, CURP, correo y teléfono, sobre **todo**
  el padrón cargado.
- **Filtros de columna (regla 7c):** **todas** las columnas de datos tienen embudo multi-selección
  (`FiltroColumnaOpciones`), no solo Personalidad. La columna **Razón Social** tiene ancho fijo de 350px.
- **Paginación:** **30 registros por página** (cliente), sobre el resultado ya filtrado/ordenado; el
  buscador siempre busca en todo el padrón, no solo en la página visible.
- **Acciones por fila:** **✏️ Editar** y **🗑 Mover a papelera** (con guardia, ver §4).
- **Botón "+ Agregar nuevo":** abre el alta; si el filtro está en un **tipo único**, premarca esa casilla
  (con el chip "Todos" no premarca ninguna → el usuario elige).
- **Componentes reutilizables nuevos:** `apps/web/src/components/Badge.tsx` (pill de color estándar) y
  `apps/web/src/components/Paginacion.tsx` (control de paginación) — extraídos para reúso (antes se
  reescribían inline en varias features).

## 3. Formulario de alta/edición (`ClienteModal`)
Campos: **Personalidad** (Física/Moral), Nombre*, Razón social, Primer/Segundo apellido, Fecha de
nacimiento, Teléfono, Correo, Contpaq ID, **RFC***, CURP, y **casillas de tipo** (Inversionista /
Arrendatario / Ticket / Usuario final). *Nombre y **RFC** son obligatorios.* Escribe en `inversionista`
(alta genera `idInversionista` y fija `idUser`, `status=true`, `pruebas=false`).

## 3b. Control de duplicados por RFC (v2.45.0)
Para evitar registros duplicados (los usuarios no buscaban antes de dar de alta), el módulo valida el **RFC**:
- **Obligatorio + formato** en alta y edición (front + Zod). La BD sigue permisiva (no rompe registros viejos
  sin RFC), pero al **editar** uno viejo habrá que capturar un RFC válido para poder guardar.
- **RFC genérico prohibido** (`XAXX010101000` nacional / `XEXX010101000` extranjero), en alta y edición. Hay
  históricos con genérico; no se migran en masa, pero al editarlos se exige el RFC real.
- **Unicidad por BASE del RFC.** El RFC = base (letras+fecha) + homoclave; como a veces omiten la homoclave,
  la detección compara por **base** (`VIBA700712` empata con `VIBA7007129F6`). Busca en **TODO** el padrón
  `inversionista` sin filtrar por tipo ni `pruebas`.
- **Comportamiento guía (no solo bloquear):**
  - **Coincidencia exacta** (mismo RFC) → bloqueo duro. Si el usuario quería **otro tipo** (ya es Inversionista
    y lo da como Arrendatario), el aviso ofrece **"Abrir y marcar {tipo}"** → abre el registro existente con esa
    casilla pre-marcada (no se crea duplicado). Si no, **"Abrir su registro"** para editarlo.
  - **Coincidencia solo de base** (homoclave distinta/faltante, posible homónimo) → **advierte** y deja
    **"Es otra persona, registrar de todos modos"** (envía `permitirSimilar=true`). El backend solo deja pasar
    la de base con esa confirmación; la **exacta nunca** se puede saltar.
- **Frontera de confianza:** la validación real (obligatorio/formato/genérico/unicidad/bloqueo exacto) vive en
  el **backend** (`ClientesService.asegurarRfcUnico`, en `crear()` y `actualizar()` —este excluye su propio id
  para no auto-bloquearse). El front es espejo cosmético. Util `rfc.util.ts` (`normalizarRfc`/`baseRfc`/
  `rfcFormatoValido`/`esRfcGenerico`); su lógica se replica en `ClienteModal.tsx` para validar en vivo.
- **PII mínima:** `verificar-rfc` devuelve solo lo necesario para el aviso (`COLS_VERIF`: id, nombre/razón
  social, RFC y banderas de tipo); para abrir/editar el existente se recarga completo con `GET /clientes/:id`
  (así no se exponen CURP/correo/teléfono/fecha de nacimiento de terceros ni se borran al editar).
- **📌 Deuda transversal detectada (validador 2026-06-29):** varios métodos del service reenvían
  `error.message` de Postgres al cliente (patrón preexistente en todo `clientes.service.ts`); pendiente
  sustituir por mensaje genérico + log server-side (no se cambió aquí por estar fuera del alcance del cambio).

## 4. Mover a la papelera (con guardia anti-huérfanos, v2.54.0)
Replica v1: `pruebas=true`, `tipoCliente='0001'`, y apaga todas las banderas de tipo
(`inversionista/arrendatario/ticket/usuarioFinal = false`). No borra el registro (queda en la Papelera).

**Guardia (nuevo):** antes de archivar, el backend verifica que el cliente **no tenga recursos vivos
ligados** que quedarían huérfanos. Si los tiene, **rechaza con 409** y un mensaje que guía a desligarlo
primero; el front muestra un aviso ("Desligar en Ventas / Arrendatarios") **sin** archivar.
- **Detector** `ClientesService.dependenciasBloqueantes(id)` (solo lectura, sin objetos de BD): cuenta en
  **4 tablas de recurso vivo** y devuelve `[{recurso, cantidad, modulo}]` de las que tengan filas:
  `propiedades.idInversionista` (Propiedades), `pdpDetalle.idInversionista` (Plan de pagos),
  `arrenPropiedades.idArrendador` (Naves rentadas), `arrePdp.idArrendador` (Plan de renta).
  ⚠️ **Gotcha:** el mismo id de cliente se referencia con dos nombres — `idInversionista` **e**
  `idArrendador` (= `idInversionista`, ver GLOSARIO).
- **Umbral:** solo esas 4 "duras" bloquean archivar; el **historial** (pagos, facturas, incidentes, docs,
  comentarios) **no** bloquea. El motivo (bug real): antes se archivaba un cliente con nave asignada y la
  **nave quedaba atrapada** en él.
- **🐛 (CORREGIDO 2026-07-04, v2.55.1) "Plan de renta" bloqueaba con planes YA TERMINADOS.** El conteo de
  `arrePdp` solo filtraba `status=true` (fila viva), pero un plan de renta **finalizado**
  (`arrePdpVigente='No'`) sigue con `status=true` en su propia fila — solo se soft-borra el **vínculo**
  padre (`arrenPropiedades.status=false`), no el plan histórico. Por eso el guardia bloqueaba archivar con
  "Plan de renta (N)" aunque el arrendamiento ya estuviera cerrado, mientras el panel "Lo que tiene ligado"
  del sheet de edición (que arma la lista de rentas **a partir de** los `arrenPropiedades` activos) sí
  mostraba "sin nada ligado" — dos criterios distintos, resultados contradictorios. **Regla de negocio
  confirmada:** un plan `arrePdpVigente='No'` no es un recurso vivo y NO debe bloquear. Fix: se agregó
  `.neq('arrePdpVigente', 'No')` a esa comprobación (mismo patrón que usa `planes-arre.service.ts`).
- **Reutilizable a futuro:** el detector queda como base para el **borrado físico permanente** (backlog;
  ver §8), que exigirá **cero** ataduras de cualquier tabla y será solo para `isSupport`.

## 5. Endpoints (backend, `@Controller('clientes')`, clave 300)
- `GET /clientes?tipo=` — listado. `tipo=todos` (v2.54.0) trae el **padrón completo** (lo usa la vista
  unificada); los valores por chip (`inversionistas|arrendatarios|ticket|usuarioFinal|papelera`) siguen
  disponibles.
- `GET /clientes/verificar-rfc?rfc=&excluirId=` — verifica duplicados por RFC (v2.45.0). ⚠️ Declarado
  **antes** de `GET /clientes/:id` para no colisionar como parámetro.
- `GET /clientes/:id/dependencias` (v2.54.0) — ataduras vivas que impiden archivar (naves/propiedades/
  planes); devuelve `[{recurso, cantidad, modulo}]` (nombres de **negocio**, no de tabla). Declarado
  antes de `:id`.
- `GET /clientes/:id` — cliente completo (para abrir/editar el existente desde un aviso de duplicado).
- `POST /clientes` — alta (valida RFC obligatorio/único/no-genérico).
- `PATCH /clientes/:id` — edición (misma validación, excluyendo su propio id).
- `POST /clientes/:id/papelera` — mover a la papelera. **Revalida el guardia** (§4): 409 si hay
  dependencias vivas.

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

## 10. Para el agente de soporte — por qué un cliente no aparece en su módulo

> Caso real que originó esta sección: **NEXGEN Packaging México** (`idInversionista=RQDyoUAlJcnq5M95q4lR`)
> existía, estaba **activo** y con **RFC válido**, pero `inversionista=false, arrendatario=false,
> ticket=false, usuarioFinal=false, pruebas=false` — sin ninguna bandera de tipo asignada. No aparecía
> en Arrendatarios ni en Ventas, y el usuario (que sí tenía el permiso 300 de Clientes) terminó abriendo
> un ticket para algo que podía resolver él mismo.

**Síntoma:** "busco a un cliente/inquilino/propietario en Inversionistas, Arrendatarios o Ventas y no me
aparece", aunque el usuario esté seguro de que existe.

**Causa (regla de datos, tabla `inversionista`):** el registro **existe** pero no cumple el requisito
del selector del módulo donde se busca — casi siempre, **no tiene marcada la bandera del tipo**
correspondiente. Hay **dos estados distintos** que producen este síntoma (NO son lo mismo):
- **"Papelera"** — `pruebas=true`. El cliente fue movido explícitamente a la papelera (dejó de
  considerarse un cliente vigente).
- **"Sin clasificar"** — `pruebas=false` **y** ninguna bandera de tipo activa (`inversionista=false AND
  arrendatario=false AND ticket=false AND usuarioFinal=false`). El cliente **existe y está activo**;
  simplemente nunca se le asignó ningún tipo (o se le quitaron todos). Es un estado **DISTINTO** de
  Papelera: no es un descarte, es un pendiente de clasificación.

**Por qué no aparece en el selector del módulo:** cada selector de negocio filtra por su(s) bandera(s)
de tipo, sin excepción:
- **Arrendatarios → Planes de Renta:** `(arrendatario=true OR usuarioFinal=true) AND status=true` —
  ver `modulos/arrendatarios.md`.
- **Ventas → Planes:** `inversionista=true AND pruebas=false AND status=true` — ver
  `modulos/inversionistas.md`.
- **Clientes → chip Ticket / Usuario Final:** `ticket=true` / `usuarioFinal=true` respectivamente.

Un cliente en **Papelera** o **Sin clasificar** no cumple ninguna de esas condiciones → **no aparece en
ningún selector de negocio**, aunque el registro exista y esté activo (`status=true`).

**Diagnóstico (con `consultar_datos`):** confirmar en `inversionista` los valores de `inversionista`,
`arrendatario`, `ticket`, `usuarioFinal`, `pruebas` y `status` del registro. Si todas las banderas de
tipo están en `false`, distinguir **Papelera** (`pruebas=true`) de **Sin clasificar** (`pruebas=false`).

**Solución (regla de negocio, no de UI):** para que el cliente aparezca en el selector de un módulo,
alguien con la **clave 300 (Clientes)** debe marcarle la bandera del tipo correspondiente (y, si estaba
en Papelera, sacarlo de `pruebas=true`) desde el módulo **Clientes**.

**Pasos de UI (vista unificada, v2.54.0):**
1. Entrar a **Clientes** (`/clientes`). Por defecto muestra **Todos** (sin la papelera).
2. **Escribir el nombre/RFC en el buscador** — así aparece aunque esté en **Papelera** (el buscador sí la
   incluye) o **Sin clasificar** (siempre visible). Se reconoce por su **badge** en la columna **Tipo**
   (gris "Papelera" / ámbar "Sin clasificar").
3. **✏️ Editar** en su fila → marcar la(s) **casilla(s) de tipo** que corresponda(n) (Inversionista /
   Arrendatario / Ticket / Usuario final). Si estaba en Papelera, al asignarle un tipo y guardar sale de
   ella. **Guardar.** (Al editar un registro viejo, el **RFC es obligatorio y no puede ser genérico**,
   §3b.)

**Síntoma 2: "no me deja mandar a un cliente a la papelera / me sale que tiene una nave"** (guardia
anti-huérfanos, §4). **Causa:** el cliente tiene **recursos vivos ligados** — el sistema lo **bloquea a
propósito** para que la nave/propiedad/plan no quede atrapada. **Regla verificada** (`ClientesService.
dependenciasBloqueantes` → `moverPapelera` responde 409; endpoint `GET /clientes/:id/dependencias`,
clave 300): bloquean `propiedades`/`pdpDetalle` (idInversionista) y `arrenPropiedades`/`arrePdp`
(idArrendador). **Solución:** **desligar primero** el recurso en su módulo (naves/renta → **Arrendatarios**;
propiedades/plan de pagos → **Ventas**) y luego reintentar mandarlo a la papelera; el aviso de la pantalla
indica qué tiene y dónde desligarlo.
