# 03 · UI / UX — Plantillas de documentos de KVA's

> Anclado a `00-brief-conceptual.md` (nomenclatura canónica) y al visual aprobado `plantillas.pen`
> (3 pantallas). Autor: Nicanor (redacción) · Arquitecto: Toribio · Fecha: 2026-10-07.
> Estado: **DISEÑO — sin construir.** Los endpoints los define el TRD; aquí solo «el API de plantillas».
> Rutas de código relativas a `version2/apps/web/src/`.

## 1. Mapa de pantallas y navegación

| # | Pantalla (nombre en el `.pen`) | Ruta | Tipo | Permiso para verla |
|---|---|---|---|---|
| 1 | Plantillas — listado | `/parques/plantillas` | Página | **Plantillas · ver** (clave nueva, TRD) |
| 2 | Plantillas — editor | `/parques/plantillas/nueva` y `/parques/plantillas/:idPlantilla` | Página completa (sin sidebar de contenido; barra propia) | **Plantillas · editar** |
| 3 | KVA's — generar documento al asignar | `/parques/kvas` (modal, sin ruta propia) | Modal sobre la página existente | Permiso de KVA's que defina el TRD (propuesta del brief: 721 + 723) |

```
Menú Parques
 ├─ Parques        /parques
 ├─ Disponibilidad /parques/disponibilidad
 ├─ KVA's          /parques/kvas ──[Generar documento]──▶ (3) Modal «Generar documento de asignación»
 └─ Plantillas     /parques/plantillas  (1) Listado
                      ├─ [+ Nueva plantilla] ─▶ /parques/plantillas/nueva        (2) Editor
                      ├─ Fila / ✎ Editar     ─▶ /parques/plantillas/:id          (2) Editor
                      ├─ ⧉ Duplicar          ─▶ crea copia y abre su editor
                      └─ ⛔ Dar de baja       ─▶ modal de confirmación con motivo
```

- **Entrada de menú:** un ítem nuevo `{ label: 'Plantillas', to: '/parques/plantillas', clave: <Plantillas · ver> }`
  **debajo de «KVA's»** en el grupo `parques` de `components/layout/menu.tsx` (hoy: 700, 710, 720). La
  `clave` la fija el TRD (no puede chocar con 720-723). El `Sidebar` ya oculta el ítem sin permiso
  (`tienePermiso(it.clave)` en `components/layout/Sidebar.tsx`).
- **Rutas:** se agregan en `routes/router.tsx` junto a `/parques/kvas`. El editor y su librería se cargan con
  `lazy` + `Suspense` (patrón ya usado en `/arrendatarios/*` y `/cxp/reportes`) para no inflar el bundle de
  quien nunca edita plantillas.
- **Descripción del permiso:** se agrega su texto en `features/permisos/permisos-descripciones.ts`
  (donde hoy viven 720-723), en lenguaje de negocio.
- **Punto de entrada del modal (3):** el flujo actual «+ Asignar» (`AsignacionKvaModal`) no cambia. Se añade una
  acción **«Generar documento»** que abre el modal nuevo. **Propuesta (P3, por confirmar):** dos puntos de
  entrada al mismo modal: (a) botón en el **encabezado de la página de KVA's** (modal vacío; se elige empresa y
  naves) y (b) botón en la **ficha de la nave** (`NaveKvaModal`), que lo abre con la **empresa y la nave ya
  marcadas**. Título del `.pen`: «Generar documento de asignación».
- **Volver:** desde el editor, la flecha «← Volver» regresa a `/parques/plantillas`; si hay cambios sin guardar
  pide confirmación (§3.3).

## 2. Pantalla 1 — Plantillas · listado

### 2.1 Estructura (de arriba abajo)
1. **Encabezado:** título «Plantillas», subtítulo «Machotes de documentos que se generan desde KVA's», y a la
   derecha el botón primario **«+ Nueva plantilla»** (azul `#1f2a4d`, texto blanco). Solo se renderiza con el
   permiso Plantillas · editar.
2. **Filtros rápidos** (una fila): búsqueda por nombre (con icono de lupa), select **Tipo** («Todos», «Asignación de
   carga», «Devolución»), select **Estado** («Todas», «Activas», «Dadas de baja»; por defecto **Activas**).
3. **Tabla** (encabezado azul `#1f2a4d`, texto blanco), columnas:

| Columna | Contenido | Notas |
|---|---|---|
| Nombre | Nombre de la plantilla | Clic en la fila abre el editor |
| Tipo | `Badge` («Asignación de carga» / «Devolución») | Etiqueta legible, nunca la clave `ASIGNACION_CARGA` |
| Versión | `v3` | Número entero de la versión vigente, `tabular-nums` |
| Actualizada | `dd/mm/aaaa HH:mm` + autor en gris | Helper único de fecha (§9) |
| Estado | `Badge` verde «Activa» / gris «Baja» | Con texto, no solo color |
| Acciones | Iconos: ✎ editar · ⧉ duplicar · ⛔ dar de baja | Con tooltip; ver permisos abajo |

- **Filtros por columna estilo Excel** en Nombre, Tipo, Versión, Actualizada y Estado (embudo en el
  encabezado). Ver §9 sobre la brecha del componente actual.
- **Ordenamiento** por columna con `SortableTh` + `useSort` (`components/tabla/`). Orden inicial: Actualizada
  descendente.
- **Exportación (P5, decidido):** **sin exportación en el listado en v1.** Son «machotes» (pocas filas, no datos
  de negocio). Es una **excepción a la regla global de tablas de datos** que debe asentarse en el contexto del
  proyecto como «Excepción acordada con Jereff (2026-10-07)». Si más adelante se quiere, la arma el servidor
  con permiso `plantillas.exportar`.
- **Paginación:** con `Paginacion` (`components/Paginacion.tsx`) si el API devuelve más de 20; con menos no se
  muestra.

### 2.2 Acciones por fila
| Icono | Acción | Permiso | Comportamiento |
|---|---|---|---|
| ✎ Editar | Abre el editor | Plantillas · editar | Navega a `/parques/plantillas/:id`. Sin permiso de edición el icono no se renderiza; la fila abre el editor en **solo lectura** si tiene «ver» (§3.6) |
| ⧉ Duplicar | Crea una plantilla nueva copiando texto y datos fijos | Plantillas · editar | Modal pequeño: «Nombre de la copia» (precargado «Copia de …»). Al confirmar, abre el editor de la copia. Nace en v1 y Activa |
| ⛔ Dar de baja | Baja lógica | Plantillas · editar | Modal de confirmación con **motivo obligatorio**. En una fila ya dada de baja el icono cambia a «Reactivar» solo si el TRD lo permite (P4); si no, no se muestra |

### 2.3 Estados
| Estado | Qué se ve |
|---|---|
| Cargando | Esqueleto de 5 filas grises (no spinner a pantalla completa); encabezado y filtros ya visibles |
| Vacío (sin plantillas) | Ilustración mínima + «Aún no hay plantillas.» + botón «+ Nueva plantilla» (si tiene permiso) o «Pide a quien administre que cree la primera.» (si no) |
| Vacío por filtros | «Ninguna plantilla coincide con los filtros.» + enlace «Quitar filtros» |
| Error | Banda roja arriba de la tabla: «No pudimos cargar las plantillas. Reintenta.» + botón «Reintentar». No se vacía la tabla anterior si ya había datos |
| Sin permiso (sin «ver») | La ruta redirige al inicio y el menú no muestra el ítem; si se llega por URL directa: «No tienes permiso para ver las plantillas.» |
| Sin permiso de edición (solo «ver») | Se ve la tabla; no hay «+ Nueva plantilla» ni iconos de acción |
| Dar de baja guardando | Botón del modal con «Dando de baja…» y deshabilitado |

## 3. Pantalla 2 — Plantillas · editor

Página completa con **tres zonas**: barra superior, barra de formato y área de trabajo (hoja + panel derecho).
Alto total = `100dvh`; solo el área de trabajo hace scroll interno (`.scrollbar-hide`, regla de UI 1).

### 3.1 Barra superior
De izquierda a derecha:
- **← Volver** (icono + texto). Si hay cambios sin guardar, abre «Tienes cambios sin guardar. ¿Salir sin guardar?»
  con «Seguir editando» / «Salir sin guardar».
- **Nombre** de la plantilla, editable en línea (input sin borde que muestra borde al enfocar). Obligatorio,
  máx. 120 caracteres.
- **Chip de tipo** (`Badge` azul, solo lectura): «Asignación de carga». En una plantilla **nueva** el tipo se
  elige antes de entrar al editor (§3.7) y **no se cambia después** (el tipo define el catálogo de campos).
- **Versión:** «v3» (en plantilla nueva: «Nueva»).
- **Cancelar** (secundario): descarta cambios (con la misma confirmación si los hay).
- **«Guardar nueva versión»** (primario azul): cada guardado crea una versión nueva (regla 5 del brief). Se
  deshabilita si no hay cambios o si hay errores de validación. En plantilla nueva dice **«Guardar plantilla»**
  (crea la v1).

### 3.2 Barra de formato
Botones-icono con tooltip y estado «activo» (fondo azul claro):

| Grupo | Controles | Atajo |
|---|---|---|
| Historial | Deshacer · Rehacer | `Ctrl/⌘+Z` · `Ctrl/⌘+Shift+Z` |
| Texto | **Negrita** · *Cursiva* · Subrayado | `Ctrl/⌘+B` · `I` · `U` |
| Alineación | Izquierda · Centro · Derecha · Justificar | `Ctrl/⌘+Shift+L/E/R/J` |
| Bloque | Lista (viñetas) | `Ctrl/⌘+Shift+8` |
| Tamaño | Select de tamaño (p. ej. 10, 11, 12, 14, 16 pt) | — |

- La barra es **sticky** bajo la barra superior. En pantallas angostas hace scroll horizontal interno sin barra.
- Solo existen estos controles: el editor **no** admite imágenes pegadas, tablas, enlaces ni colores (la
  lista permitida de nodos y marcas del servidor es la misma, regla 2 del brief). Pegar contenido externo se
  limpia a texto plano con los formatos de arriba.

### 3.3 La hoja
- **Hoja tipo carta** (21.59 × 27.94 cm, proporción fija) centrada sobre fondo `#f9fafb`, con sombra suave.
  En el editor la hoja es el mismo ancho que la del PDF para que «lo que ves es lo que sale».
- **Membrete** (D11; no editable, bloqueado): **el mismo `Logo`** de la plataforma (`components/Logo.tsx` →
  `configuracionApi.getLogos`) + «Grupo SPH» y su domicilio, tomados de la configuración del sistema. Lo
  muestran **la hoja del editor y la vista previa de generación**, y **el PDF final lo lleva**. El membrete **no es
  parte del texto editable**; lo agrega el servidor al generar el PDF. Si no hay logo configurado se muestra solo el texto.
- **Cuerpo editable:** el texto de la carta. Dentro del texto viven dos clases de elementos **atómicos**
  (se seleccionan, se mueven y se borran como una sola pieza; el cursor nunca queda «dentro» de ellos):

| Elemento | Color | Ejemplo | Origen |
|---|---|---|---|
| **Campo automático** | Chip **verde** (`#8cc63f` borde, fondo verde claro) | `[empresa]`, `[naves]`, `[kvas por nave]`, `[fecha]` | Catálogo cerrado del tipo; el servidor lo sustituye desde la BD |
| **Dato fijo** | Chip **azul** (`#1f2a4d` borde, fondo azul claro) | `[apoderado]`, `[destinatario]`, `[oficio]` | Se escribe una vez en el panel derecho; vive en la plantilla |

- Los chips muestran la **etiqueta legible** (no la clave técnica). Al pasar el cursor, tooltip con
  «Se sustituye con: razón social de la empresa» (campo) o con el valor actual (dato fijo).
- **Insertar:** clic en un campo/dato del panel derecho lo inserta en la posición del cursor; también se
  arrastra al texto. Escribir `/` (o `{`) en el texto abre un menú de inserción con búsqueda (§4.3).
- **Dato fijo vacío:** el chip se muestra en **ámbar** con «(sin definir)» y la plantilla no se puede guardar
  hasta que todos los datos fijos usados en el texto tengan valor (§3.5).
- **Campo no permitido para el tipo:** imposible de insertar (no está en el menú). Si llega en un contenido
  viejo, el chip se marca en rojo «Campo no disponible» y bloquea el guardado.

### 3.4 Panel derecho (300 px)
Fijo, con scroll interno sin barra. Dos secciones:

**A. «Campos automáticos»** — agrupados por fuente, cada grupo colapsable, con encabezado en mayúsculas y
chip verde por campo (clic = insertar):
- **INVERSIONISTAS:** Empresa.
- **PARQUES:** Parque.
- **PROPIEDADES:** Naves · KVA por nave · Nivel de tensión. (`figura` **sale de la v1**, D14.)
- **SISTEMA:** Fecha.

El catálogo exacto (nombres y claves) lo cierra el TRD (brief §7); la UI **lo pinta tal como lo entrega el
API de plantillas** para el tipo, sin lista escrita a mano en el front. Debajo de cada campo, una línea gris con
un ejemplo («BAJÍO EMPAQUES», «107 al 110 y 119 al 122», «5 KVAS»). Si el tipo es `DEVOLUCION` y la pregunta del
brief §7 sigue abierta, el grupo sale con los campos comunes y el aviso «Los campos de devolución se habilitarán
más adelante.» (P2).
**Tipo `DEVOLUCION` en v1 (D14):** se puede crear y editar, pero **sin campos propios**: el panel «Campos
automáticos» muestra los campos comunes que el API entregue para el tipo y, arriba, un aviso gris «Esta plantilla
aún no tiene campos propios de devolución; se habilitarán más adelante. Puedes escribir el texto y usar los datos
fijos.» Los datos fijos siguen disponibles. En el modal de generación (pantalla 3) este tipo **no se ofrece** en v1.

**B. «Datos fijos de la plantilla»** — inputs de texto, uno por dato, se escriben una sola vez:

| Dato | Control | Validación |
|---|---|---|
| Apoderado | Input de texto | Obligatorio si se usa en el texto; máx. 150 |
| Destinatario | Input de texto (puede ser multilínea corta) | Ídem; máx. 300 |
| Oficio | Input de texto | Ídem; máx. 80 |
| Solicitud (CFE) | Input de texto | Ídem; máx. 80 |
| Domicilio | Textarea (2-3 líneas) | Ídem; máx. 300 |

- Al teclear, **todos los chips azules de esa clave se actualizan en vivo** en la hoja.
- Un dato fijo que no aparece en el texto se muestra con un punto gris y la nota «No se usa en el texto»
  (no bloquea).
- Cada input trae su etiqueta visible (no solo placeholder) y su texto de ayuda de una línea.
- La lista de datos fijos para ASIGNACION_CARGA es la del `.pen`; para otros tipos la define el TRD.

### 3.5 Validaciones y mensajes (todos en español)
| Situación | Mensaje | Efecto |
|---|---|---|
| Nombre vacío | «Escribe un nombre para la plantilla.» | Marca el input y bloquea el guardado |
| Nombre repetido (mismo tipo, activa) | «Ya existe una plantilla activa con ese nombre.» (si el TRD lo exige, P6) | Bloquea |
| Texto vacío | «La plantilla no tiene texto.» | Bloquea |
| Dato fijo usado sin valor | «Falta el dato fijo «Apoderado», que usas en el texto.» | Resalta el input y el chip; el foco va al input |
| Campo fuera del catálogo | «El campo «…» no está disponible para este tipo.» | Bloquea |
| Excede longitud | «Máximo N caracteres.» | Bloquea |
| Guardado correcto | «Se guardó la versión 4.» (toast verde, 4 s) | Actualiza el chip de versión |
| Error del API | «No se pudo guardar. Tus cambios siguen aquí; reintenta.» | No se pierde el contenido |

La validación del front es **comodidad**; la autoridad es el servidor (Zod + saneo por lista permitida, brief
regla 2). Si el servidor rechaza, se muestra su mensaje en español bajo la barra superior.

### 3.6 Estados del editor
| Estado | Qué se ve |
|---|---|
| Cargando | Barra superior con esqueletos, hoja gris con 6 líneas animadas, panel derecho con esqueletos. Editor deshabilitado |
| Error al cargar | Pantalla central: «No pudimos abrir la plantilla.» + «Reintentar» + «Volver al listado» |
| Plantilla no encontrada | «Esta plantilla no existe o fue eliminada.» + «Volver al listado» |
| Sin permiso de edición (solo «ver») | Editor en **solo lectura**: sin barra de formato, inputs deshabilitados, banda gris «Solo lectura: no tienes permiso para editar plantillas.», sin Guardar |
| Plantilla dada de baja | Solo lectura + banda ámbar «Esta plantilla está dada de baja (motivo: …).» + «Duplicar» para reutilizarla |
| Cambios sin guardar | Punto ámbar junto al nombre + «Cambios sin guardar» en gris; `beforeunload` del navegador activo |
| Guardando | «Guardar nueva versión» → «Guardando…» deshabilitado con spinner; el editor queda en solo lectura unos instantes para no perder pulsaciones |
| **Conflicto de versión** | Si otro usuario guardó una versión mientras se editaba (el servidor rechaza por versión base desactualizada): modal «Otra persona guardó la versión N mientras editabas». Opciones: **«Ver su versión»** (abre en pestaña nueva solo lectura), **«Guardar la mía como versión N+1»** (reenvía sobre la última, con confirmación) y **«Descartar mis cambios»**. Nunca se sobreescribe en silencio |
| Sesión expirada | El cliente HTTP ya redirige al login (patrón de `lib/api.ts`); antes se guarda un borrador local (§3.8) |

### 3.7 Alta: elegir el tipo
«+ Nueva plantilla» abre un **modal pequeño** (portal) con: «Nombre» y «Tipo» (select con los dos tipos fijos;
lista cerrada, D1 del brief — nunca se teclea el código). «Continuar» entra al editor con el tipo ya definido y,
si existe, un **texto inicial sugerido** del tipo (lo entrega el API; P7 si Jereff quiere uno de arranque).

### 3.8 Borrador local
El editor guarda un borrador por plantilla en `localStorage` cada pocos segundos (clave por plantilla y usuario),
**solo como respaldo ante cierre accidental o sesión expirada**; se envuelve en try/catch y la pantalla funciona
igual sin él. Al reabrir con un borrador más reciente que la versión del servidor se ofrece «Recuperar mis
cambios sin guardar» / «Descartar». El borrador no es fuente de verdad y nunca se envía solo.

## 4. El componente de EDITOR

### 4.1 Recomendación: **Tiptap** (sobre ProseMirror)
**Estado actual verificado** (`apps/web/package.json`): **no hay ningún editor de texto enriquecido
instalado.** Lo único afín es `react-markdown` + `remark-gfm` (render, no edición), `jspdf`/`jspdf-autotable`
y `html-to-image` (los usa el front para otros reportes). Hay que **agregar dependencias nuevas**.

| Criterio | Tiptap/ProseMirror | Lexical | Quill | `contenteditable` propio |
|---|---|---|---|---|
| Nodos atómicos inline propios (campo, datoFijo) | Sí, de primera clase (`atom: true`, NodeView React) | Sí (DecoratorNode) | Difícil (blots) | Frágil |
| Esquema cerrado (lista permitida de nodos/marcas) | **Sí: el esquema ES la lista permitida**; lo que no está no se puede crear ni pegar | Parcial | Parcial | No |
| Serialización JSON estable y versionable | Sí (`doc` JSON) | Sí | Delta, propio | No |
| Mismo esquema en servidor (validar/sanear y renderizar PDF) | **Sí, `@tiptap/core`/ProseMirror corren en Node sin DOM del navegador**; el mismo esquema valida | No tan directo | No | No |
| Deshacer/rehacer, atajos, pegado limpio | Incluidos | Incluidos | Incluidos | A mano |
| Tamaño/madurez | Media, muy usado, licencia MIT del núcleo | Menor ecosistema de extensiones | Antiguo | — |

**Justificación (una frase):** el esquema de ProseMirror convierte la regla 2 del brief («entrada hostil,
saneo con lista permitida, campos solo del catálogo») en una propiedad del editor, y el **mismo esquema**
puede validar en el servidor el JSON que llegue, evitando HTML libre.

**Paquetes mínimos propuestos** (todos MIT; la versión exacta la fija el TRD): `@tiptap/react`,
`@tiptap/pm`, `@tiptap/starter-kit` (párrafo, negrita, cursiva, lista, historial) y las extensiones
`@tiptap/extension-underline` y `@tiptap/extension-text-align`; el tamaño de letra se implementa como **marca
propia** con valores de una lista fija (no CSS libre). **No** se usan extensiones de pago de Tiptap.
⚠️ Alerta de riesgo para el TRD: confirmar la licencia vigente de cada paquete antes de instalar.

### 4.2 Formato de contenido
- El editor entrega y recibe **JSON de ProseMirror** (no HTML) como contenido de la plantilla. Es el formato
  que se versiona, se valida con Zod en el API y se convierte a PDF en el servidor. La conversión a HTML para
  el PDF la hace el servidor; el front **nunca** manda HTML a renderizar. (Formato exacto: TRD.)
- El JSON viaja como contenido de la plantilla; el front no confía en él al reabrir: el editor lo carga contra
  su esquema y descarta nodos desconocidos.

### 4.3 Nodos propios
| Nodo | Tipo | Atributos | Vista |
|---|---|---|---|
| `campo` | inline, **atómico**, no editable por dentro | `clave` (del catálogo cerrado del tipo) | Chip verde con la etiqueta legible |
| `datoFijo` | inline, **atómico** | `clave` (de la lista de datos fijos) | Chip azul con el **valor actual** del dato fijo; ámbar si está vacío |

- Ambos se insertan con comando (`insertCampo(clave)`, `insertDatoFijo(clave)`), con el menú `/` y con
  arrastre desde el panel derecho.
- Borrado con Backspace/Delete borra el chip completo (un solo paso, deshacible).
- Copiar/pegar dentro del editor conserva los chips; pegar desde fuera se convierte a texto plano filtrado.
- El valor de un dato fijo **no** vive en el nodo: el nodo guarda solo la `clave`, y el valor sale del estado
  del panel derecho. Así cambiar el apoderado en un lugar lo cambia en todo el texto.

### 4.4 Vista previa editable (al generar, pantalla 3)
Se reutiliza **el mismo componente de editor** con una configuración distinta: `modo="generacion"`. En ese modo
los chips ya no son chips sino **texto resuelto resaltado** (los valores que llegaron del servidor, con fondo
amarillo claro), la barra de formato se reduce (negrita/cursiva/subrayado/alineación) y los nodos `campo`/
`datoFijo` ya vienen resueltos a texto por el API de generación. El ajuste que haga la persona **aplica solo a ese
documento** (regla 7 del brief) y el servidor es quien arma el PDF final con el texto aprobado en pantalla,
validándolo con el mismo esquema.

### 4.5 Accesibilidad del editor
- Área editable con `role="textbox"`, `aria-multiline="true"` y `aria-label="Texto de la plantilla"`.
- Barra de formato con `role="toolbar"`, botones con `aria-pressed` y nombre accesible; navegación con flechas
  dentro de la barra (`roving tabindex`).
- Cada chip expone `aria-label` («Campo automático: empresa» / «Dato fijo: apoderado, valor …»).
- Los cambios de estado críticos (guardado, error) se anuncian con una región `aria-live="polite"`.
- Todo atajo tiene su botón equivalente; nada depende solo del arrastre ni solo del color (los chips llevan
  además un pequeño icono distinto: rayo para automático, lápiz para fijo).

## 5. Pantalla 3 — KVA's · «Generar documento de asignación» (modal)

### 5.1 Estructura
Modal ancho (`max-w-5xl`, dos columnas en escritorio) **en portal sobre `body`**, con velo, Escape y clic fuera
para cerrar (con confirmación si hay edición en la vista previa, §5.5). Scroll interno sin barra en cada columna.

**Cabecera:** barra azul `#1f2a4d`, título **«Generar documento de asignación»**, botón ✕.

**Columna izquierda (selección):**
1. **Empresa** — `SearchSelect` (`components/SearchSelect.tsx`), obligatorio, con las empresas
   (`inversionista`, 409 activas: **dueños y arrendatarios**, D12); muestra razón social. Al cambiarla se limpian
   plantilla de nave y selección de naves.
2. **Parques de las naves marcadas** (D13) — campo **informativo, no editable**, que muestra los nombres de los
   parques de las naves marcadas, separados por coma («Parque Norte, Parque Sur»); vacío con «—» mientras no
   haya naves marcadas. Ya no es el parque de la página desde donde se abrió.
3. **Plantilla** — select **filtrado por tipo** (en esta pantalla solo `ASIGNACION_CARGA`) y por «Activa»;
   muestra «Nombre · v3». Si hay una sola, queda preseleccionada.
4. **Naves de la empresa** (D12, D13) — la **Empresa** incluye **dueños y arrendatarios**, y la lista trae las
   naves que la empresa tiene **como dueña o como arrendataria**, **agrupadas por parque** (encabezado de grupo
   con el nombre del parque y su propia casilla «marcar el parque»; pueden mezclarse parques sin restricción).
   Cada nave es una fila: casilla · «Nave 107» · etiqueta de relación («Dueña» / «Arrendataria», `Badge`
   gris) · **input numérico «KVA»** · **select «Nivel»**. Arriba, casilla **«Marcar todas»** (indeterminada si
   hay selección parcial). Contador «N de M naves seleccionadas».
   - **KVA por nave (D10):** input numérico **editable por nave**, texto con `inputMode="numeric"` (se puede
     dejar vacío; el estado guarda lo que se teclea, se convierte al validar). **Prellenado con la dotación de
     la nave si es > 0**; si la dotación es 0 o no existe, queda **vacío y obligatorio** (borde ámbar con
     placeholder «KVA»). Entero ≥ 1, máximo 99,999.
   - **Nivel por nave:** select cerrado «Baja tensión» / «Media tensión», **prellenado** según la dotación (si
     la nave solo tiene dotación baja → baja; solo media → media). Con dotación 0 o mezcla en la nave, queda
     **vacío y obligatorio**. Es un código de conjunto conocido: se elige, no se teclea.
   - **Nave con dotación 0 YA NO se deshabilita (D10):** se puede marcar y se teclea su KVA y su nivel. Lleva
     la nota gris «Sin dotación: captura los KVA» para explicar por qué los inputs vienen vacíos.
   - Los inputs de una nave solo se habilitan cuando su casilla está marcada; desmarcar conserva lo tecleado
     durante la sesión del modal.
   - **Diferencia con el mockup (a corregir):** el `plantillas.pen` aprobado muestra la nave sin dotación
     **deshabilitada** y KVA/nivel como texto. Se corrige **en el `.pen`** (pantalla 3: nave sin dotación con
     inputs habilitados, KVA como input, nivel como select) porque es parte del diseño autorizado (gate de
     diseño); la construcción **no** debe apartarse del visual sin que Jereff lo apruebe. Hasta entonces: PARAR
     antes de construir esta pantalla.

**Columna derecha (vista previa):**
- **Aviso ámbar** arriba: «Vista previa editable: tus ajustes aplican solo a este documento.»
- **Hoja** (misma hoja carta que el editor, solo membrete bloqueado) con el texto **ya resuelto** y los valores
  tomados de la BD **resaltados** (fondo amarillo claro). La persona puede ajustar el texto (§4.4).
- Un enlace **«Restablecer texto»** descarta los ajustes y vuelve al texto generado.
- Mientras no haya Empresa + Plantilla + al menos una nave, la hoja muestra el estado vacío (§5.4).

**Pie fijo:** a la izquierda, el resumen **«Se generará 1 PDF y se guardará en el expediente de N naves»**
(N en vivo, con singular: «de 1 nave»); a la derecha **Cancelar** (secundario) y **«Generar PDF y guardar»**
(primario azul, deshabilitado hasta que haya Empresa, Plantilla y ≥ 1 nave).

### 5.2 Comportamiento
1. Elegir Empresa → el API de plantillas devuelve sus naves (como dueña o arrendataria, de uno o varios parques) con su dotación si la hay (la regla de dueño vs.
   arrendatario la resuelve el TRD; la UI solo pinta lo que llega).
2. Elegir Plantilla y marcar naves → la vista previa se **recalcula en el servidor** (los valores resueltos
   nunca se calculan en el cliente) con debounce de ~400 ms; mientras llega, la hoja se atenúa con un aviso
   «Actualizando vista previa…».
3. Si la persona ya editó la vista previa y cambia selección: aviso «Cambiar la selección regenerará el texto
   y perderás tus ajustes. ¿Continuar?».
4. **«Generar PDF y guardar»** → el servidor valida pertenencia nave↔empresa↔parque (regla 6 del brief), arma el PDF,
   lo guarda en el expediente de cada nave seleccionada (`kvaNaveDocs`) y devuelve el resultado.
5. Éxito: el modal cambia a un estado final con «Documento generado.», un enlace **«Abrir PDF»** (pestaña nueva) y
   la lista de naves donde quedó guardado; botón «Listo» cierra y refresca el expediente.

### 5.3 Validaciones y mensajes
| Situación | Mensaje |
|---|---|
| Sin empresa | «Elige la empresa.» (junto al select) |
| Sin plantilla | «Elige la plantilla.» |
| Ninguna nave marcada | «Marca al menos una nave.» (botón deshabilitado) |
| Empresa sin naves | «Esta empresa no tiene naves como dueña ni como arrendataria.» |
| Nave marcada sin KVA | «Captura los KVA de la nave 107.» (bajo el input, rojo; botón principal deshabilitado) |
| KVA inválido | «Los KVA deben ser un número entero mayor que 0.» |
| Nave marcada sin nivel | «Elige el nivel de la nave 107.» |
| Plantilla con dato fijo vacío | **Advertir y permitir** (propuesta, P8): aviso ámbar «La plantilla tiene datos fijos sin definir: «Apoderado». Complétalos en Plantillas o escríbelos en la vista previa.» No bloquea |
| Éxito | «Documento generado y guardado en N naves.» (toast verde) |
| Error del API | «No se pudo generar el documento. No se guardó nada; reintenta.» |
| Falla parcial | «El PDF se generó pero no se pudo guardar en la nave X. Reintenta solo esa.» (modo de falla lo define el TRD; P9) |

### 5.4 Estados
| Estado | Qué se ve |
|---|---|
| Inicial | Columna derecha con la hoja vacía y el texto «Elige empresa, plantilla y naves para ver el documento.» |
| Cargando empresas / naves / plantillas | Esqueleto o `Cargando…` dentro del control; el resto sigue usable |
| Vista previa generándose | Hoja atenuada + indicador; botón principal deshabilitado |
| Generando PDF | Botón «Generando…» con spinner, todo el modal en solo lectura (sin cerrar con Escape ni clic fuera); si tarda, texto «Esto puede tardar unos segundos.» |
| Sin plantillas activas del tipo | En lugar del select: «No hay plantillas activas de asignación de carga.» + enlace «Ir a Plantillas» (solo si tiene permiso de ver) |
| Sin permiso | El botón «Generar documento» **no se renderiza** en KVA's (permiso de KVA's que fije el TRD). Si se cierra el permiso con el modal abierto, el servidor responde 403: «No tienes permiso para generar documentos.» |
| Error | Banda roja dentro del modal con «Reintentar»; la selección se conserva |
| Conflicto de versión | Si la plantilla cambió de versión mientras el modal estaba abierto: «La plantilla se actualizó a la versión N. Se regenerará la vista previa.» (se re-resuelve; los ajustes manuales se pierden con confirmación) |
| Éxito | Estado final descrito en §5.2.5 |

### 5.5 Cierre
Si hay ajustes en la vista previa sin generar, cerrar (✕, Escape, clic fuera, Cancelar) pide: «Perderás tus ajustes
a este documento. ¿Cerrar?» con «Seguir aquí» / «Cerrar».

### 5.6 Responsividad — el modal en móvil
- **≥ 1024 px:** dos columnas (selección 40 % · vista previa 60 %), pie fijo.
- **768-1023 px:** dos columnas más estrechas; la hoja se escala por CSS (`transform: scale`) manteniendo la proporción.
- **< 768 px (usa `useMediaQuery('(max-width: 767px)')` de `lib/useMediaQuery.ts`, el mismo corte que `AppShell`):**
  el modal pasa a **pantalla completa** (`100dvh`, sin esquinas), con **dos pasos con pestañas** (`Tabs`,
  `components/Tabs.tsx`): **«1 · Selección»** y **«2 · Vista previa»**. El botón del pie dice «Siguiente» en el
  paso 1 y «Generar PDF y guardar» en el paso 2. El resumen «Se generará 1 PDF…» queda sobre los botones, en una
  línea. La hoja de la vista previa se escala al ancho de pantalla y admite **pellizco para zoom** y
  desplazamiento horizontal interno. Blancos de toque de **≥ 44 px**.
- El **editor (pantalla 2)** en móvil: se muestra, pero con barra de formato en scroll horizontal y el panel de
  campos como **hoja inferior** (`Sheet` de `components/Sheet.tsx`, hoy entra por la derecha) abierta con un botón
  «Campos»; se declara que **editar plantillas se pensó para escritorio** (P10).
- El listado se convierte en tarjetas apiladas por debajo de 640 px, conservando las mismas acciones.

## 6. Accesibilidad (transversal)
- Todo modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título, **foco atrapado**, foco inicial
  en el primer control, devuelve el foco al botón que lo abrió al cerrar; Escape cierra (salvo mientras genera).
- Casillas con etiqueta asociada; «Marcar todas» con estado `indeterminate`.
- La información nunca va solo en color: Activa/Baja con texto; nave sin dotación con texto «Sin dotación: captura los KVA»;
  chips con icono; aviso ámbar con icono de advertencia.
- Contraste mínimo AA: texto blanco sobre `#1f2a4d` cumple; el verde `#8cc63f` **no** se usa como color de
  texto sobre blanco (solo como borde/fondo claro con texto oscuro).
- Iconos sin texto con `aria-label` y tooltip; los tooltips aparecen también con foco de teclado.
- Mensajes dinámicos (errores, éxito, «Actualizando vista previa…») en `aria-live`.
- Todo funciona con teclado: tabla, filtros de columna, barra de formato, chips (Enter abre su campo en el
  panel), modal.

## 7. Estados globales de datos (resumen)
| Estado | Patrón común |
|---|---|
| Cargando | Esqueleto del propio componente, no pantalla en blanco |
| Vacío | Texto en español + acción siguiente (o aviso de a quién pedirla) |
| Error | Banda roja + «Reintentar», se conservan los datos previos |
| Sin permiso | El control **no se renderiza**; el servidor es la autoridad (403 con mensaje en español) |
| Guardando | Botón con texto de progreso + deshabilitado; evita doble envío |
| Conflicto de versión | Modal con opciones explícitas; nunca sobreescribir en silencio |

## 8. Reglas de UI del proyecto — cómo se cumplen
| Regla | Cumplimiento en este diseño |
|---|---|
| Scroll interno sin barra visible | Columnas del modal, panel derecho, área de la hoja y barra de formato usan `.scrollbar-hide` (ya existe en `index.css`). El scroll de la página principal **no** se oculta |
| Modales y flotantes en **portal** sobre `body` | Modal de generación, modal de alta/duplicar/baja y la confirmación de conflicto usan el **componente `Modal` compartido (nuevo, §10)**. Menú de filtros, menú `/` del editor, desplegables y tooltips van en portal con `position: fixed` |
| Fechas `dd/mm/aaaa` con componente propio | «Actualizada» y fechas del documento se muestran con el helper único (§9). El campo `fecha` del documento es automático y editable con **`InputFecha`** (`components/InputFecha.tsx`); nunca `<input type="date">` |
| Tabla con filtros por columna + exportación | El listado lleva filtros por columna estilo Excel (§9) y su exportación se resuelve en P5; si se hace, la arma el **servidor** con los filtros como criterios y respeta el permiso `plantillas.exportar`; nunca con filas del cliente |
| Imagen en visor con zoom | El logo del membrete no es contenido subido por el usuario; si en el futuro se adjuntan imágenes al documento, deben abrirse en visor. **El proyecto aún no tiene `VisorImagen`**; el PDF final se abre en el visor del navegador |
| Campos numéricos que se pueden vaciar | El **KVA por nave** (D10) es input de texto numérico que se puede dejar vacío; se convierte a número al validar/enviar, nunca `Number(v) \|\| 0`. Recomendado un `CampoNumero` compartido (no existe en el código hoy) |
| Códigos de un conjunto conocido se **eligen** | Tipo de plantilla y Estado son selects cerrados; Empresa y Plantilla son selects con búsqueda; nada se teclea como código |
| Todo importe dice su divisa | No hay importes en estas pantallas |
| Soporte de la plataforma ve y opera todo | Soporte ve el ítem de menú y puede editar y generar sin restricciones; toda acción queda **a nombre de soporte** (auditoría del API), sin suplantar al dueño |
| Cancelar / corregir (ciclo de vida) | Las plantillas se dan de baja con motivo; el documento generado es inmutable y se corrige generando otro y dando de baja el anterior con motivo (brief regla 4) — esa baja se hace desde el expediente de la nave (`DocumentosNave`) |

## 9. Hallazgos sobre los componentes compartidos existentes (brechas a corregir o acordar)
Verificado en el código:
1. **No hay modal compartido en portal.** `AsignacionKvaModal.tsx` dibuja `fixed inset-0 z-50` **dentro del árbol
   de la página** (sin `createPortal`); lo mismo el resto de modales de `features/parques/`. Es la brecha que la
   regla de UI describe (el modal puede quedar bajo el sidebar). **Este paquete crea el `Modal` compartido** y lo
   usa; migrar los modales existentes queda fuera de alcance → pendiente a registrar.
2. **`components/tabla/ColumnFilter.tsx` ya usa portal** (`createPortal`, `position: fixed`) pero es de
   **selección única**; la regla vigente (2026-10-06) pide **selección múltiple, arranque en blanco, «Seleccionar
   todo» solo de lo visible, «Listo» y «Quitar filtro»**. Hay también `FiltroColumnaOpciones.tsx` (mismo directorio)
   que **se debe revisar antes de decidir** (P11). Para el listado de plantillas hay dos caminos: extender el
   componente compartido a multiselección (beneficia a todo el ERP) o usarlo tal cual y registrar la brecha.
3. **No hay componente `Flotante` ni `Tooltip` compartido**; `components/ui/` existe pero está **vacío**. Los
   tooltips y el menú `/` del editor necesitan uno; se crea `Flotante` (portal + `position: fixed`) y se usa también
   para el menú del editor.
4. **No hay `VisorImagen`/`ImagenAmpliable`** (ver §8).
5. **La exportación de otras pantallas se arma en el cliente** (`exceljs`, `jspdf` en `features/*/…-export.ts`),
   contra la regla actual (la exportación la arma el servidor). Esta pantalla **no** lo replica.
6. **El PDF del documento lo arma el servidor** (regla 1 del brief); `jspdf` y `html-to-image` del front **no se
   usan** aquí.

## 10. Reutilizar vs. crear
| Necesidad | Reutilizar (ruta real) | Crear |
|---|---|---|
| Layout, sidebar, menú, permisos de ruta | `components/layout/AppShell.tsx`, `Sidebar.tsx`, `menu.tsx`; `features/auth/useAuth` (`tienePermiso`) | — (solo agregar el ítem de menú y las rutas en `routes/router.tsx`) |
| Texto de permisos | `features/permisos/permisos-descripciones.ts` | Entradas nuevas para Plantillas · ver/editar |
| Chips de estado y tipo | `components/Badge.tsx` (variantes azul, verde, ámbar, gris, rojo) | — |
| Ordenar columnas | `components/tabla/SortableTh.tsx`, `components/tabla/useSort.ts` | — |
| Filtro de columna estilo Excel | `components/tabla/ColumnFilter.tsx`, `components/tabla/FiltroColumnaOpciones.tsx` | **Extender a multiselección** según regla 2026-10-06 (o registrar brecha) |
| Paginación | `components/Paginacion.tsx` | — |
| Select con búsqueda (Empresa, Plantilla) | `components/SearchSelect.tsx` (y `MultiSearchSelect.tsx` si hace falta) | — |
| Fecha dd/mm/aaaa | `components/InputFecha.tsx` | Helper único `formatearFecha` / `formatearFechaHora` si no existe (buscar antes en `lib/`) |
| Logo / membrete | `components/Logo.tsx` + `features/configuraciones/configuracion.api` (`getLogos`) | Componente `Membrete` (logo + domicilio de Grupo SPH) compartido entre el editor y la vista previa |
| Pestañas (pasos en móvil) | `components/Tabs.tsx` | — |
| Panel lateral (campos en móvil) | `components/Sheet.tsx` | — |
| Detección de móvil | `lib/useMediaQuery.ts` | — |
| Cliente HTTP y errores | `lib/api.ts` (`api`, `ApiRequestError`), `@tanstack/react-query` | `features/parques/plantillas.api.ts` (cliente del API de plantillas; patrón de `kvas.api.ts`) |
| Íconos | `components/icons.tsx` | Los que falten (duplicar, baja, negrita, etc.), en el mismo archivo |
| Error de pantalla | `components/ErrorBoundary.tsx` | — |
| Patrón de página, consultas y modales de KVA's | `features/parques/KvasPage.tsx`, `AsignacionKvaModal.tsx`, `DevolucionKvaModal.tsx`, `kvas.api.ts` | — |
| Expediente de la nave (donde cae el PDF) | `features/parques/DocumentosNave.tsx` | Refrescarlo tras generar (invalidar la consulta) |
| Scroll sin barra | Clase `.scrollbar-hide` en `index.css` | — |
| **Modal en portal** | — | **`components/Modal.tsx`** (portal sobre `body`, velo, Escape, clic fuera, foco atrapado, bloqueo del scroll del body, `titulo`/`ancho`/`cabeceraAzul`) |
| **Flotante / Tooltip** | — | **`components/Flotante.tsx`** (portal + `position: fixed`, recoloca en scroll/resize, voltea arriba si no cabe, Escape y clic fuera) y `Tooltip` basado en él |
| **Editor** | — | `features/parques/plantillas/EditorPlantilla.tsx` (Tiptap, modos `edicion` y `generacion`), `nodos/CampoNode.tsx`, `nodos/DatoFijoNode.tsx`, `BarraFormato.tsx`, `PanelCampos.tsx` |
| **Páginas** | — | `PlantillasPage.tsx` (listado), `PlantillaEditorPage.tsx` (editor), `GenerarDocumentoModal.tsx` (pantalla 3) |
| Dependencias | — | Tiptap (§4.1); **nada más** (sin librerías de PDF ni de componentes en el front) |

## 11. Preguntas abiertas
| # | Pregunta | Quién | Recomendación |
|---|---|---|---|
| P1 | ¿Quién puede ver Plantillas vs. editar? Se asumió «ver» y «editar» como claves separadas (brief §6); la clave exacta la fija el TRD | TRD | Dos claves nuevas, sin colisión con 720-723 |
| P2 | Campos del tipo `DEVOLUCION` (brief §7 pendiente de Jereff) | Jereff | v1 solo `ASIGNACION_CARGA` con campos completos; `DEVOLUCION` declarado sin campos propios |
| P3 | **Propuesta:** botón «Generar documento» en el encabezado de KVA's y en la ficha de la nave (esta última precarga empresa y nave) | Jereff | Confirmar |
| P4 | ¿Se pueden reactivar plantillas dadas de baja? | Jereff / TRD | Sí, con auditoría; si no, solo duplicar |
| P5 | **Cerrada:** sin exportación en el listado en v1 (excepción a asentar en el contexto) | — | — |
| P6 | ¿Nombre único por tipo entre plantillas activas? | Jereff / TRD | Sí |
| P7 | ¿Texto inicial sugerido al crear una plantilla nueva? | Jereff | Cargar la carta de ejemplo de EM BAJÍO EMPAQUES ya con chips |
| P8 | **Propuesta:** advertir y permitir generar con datos fijos vacíos (aviso ámbar) | Jereff | Confirmar |
| P9 | Modo de falla al guardar en varias naves (todo o nada vs. parcial) | TRD | Todo o nada en una sola transacción |
| P10 | ¿Editar plantillas desde móvil es requisito? | Jereff | Solo lectura o edición básica en móvil; edición completa en escritorio |
| P11 | ¿Se acuerda extender `ColumnFilter` a multiselección ahora o registrar la brecha? | Toribio | Extender (beneficia a todo el ERP) si no abulta el alcance |
| P12 | Orden y nombres exactos de los cinco datos fijos y del catálogo de campos que verá la persona | Jereff / TRD | Los del `.pen`, con etiquetas legibles |
