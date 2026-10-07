# 02 · TRD — Plantillas de documentos de KVA's

> Anclado a `00-brief-conceptual.md`. Esquema SQL, endpoints y Zod exactos: `05-BACKEND.md`.
> Autor: Nicanor (Sonnet) por encargo de Toribio. Fecha de verificación: **2026-10-07** contra la BD
> `szjlkvakwljssdnysazp` (solo `SELECT`) y el código de `version2/`. **Nada se construyó ni se aplicó.**

## 0. Discrepancias con el brief (nada se corrigió en silencio)

> Actualizado tras las decisiones **D10-D14** de Jereff/Toribio (brief §2). Lo que D10-D14 ya resolvió se marca ✅.

| # | El brief dice | La realidad verificada | Efecto en el diseño |
|---|---|---|---|
| X-1 ✅ | El caso inicial: EM BAJÍO EMPAQUES, naves 107-110 y 119-122, «5 KVAS en baja tensión» (§1). | La empresa existe como **arrendataria** de 8 naves de **Acupark III**, pero esas naves tienen `dotacionBt = dotacionMt = 0`, 0 filas en `kvasAsignados` y `parques.kvasBt = 0`. Solo hay dotación en **Spartek, Spartek II, Spartek III y Prueba Parque** (159 de 636 naves). | **Resuelto por D10**: la cantidad la **declara el usuario** al generar; la dotación solo **prellena**. El caso inicial se puede generar tecleando «5». |
| X-2 ✅ | `figura` viene de «Propiedades» (§7). | Solo existe en `kvasAsignados` (77 naves) y contradice la tenencia (53 de 85 asignaciones son VENTA sobre naves con arrendamiento vivo). | **D14**: `figura` fuera de v1. |
| X-3 | `kvasAsignados` es fuente posible de KVA por nave (§4). | No sirve (77 naves, sin empresa, varias filas por nave/nivel). `naves.dotacionBt/Mt` es solo el **prellenado** (D-5). | D-5. |
| X-4 | `kvaPlantillas.datosFijos` guarda los datos fijos (§3). | En la cabecera mutable, un documento viejo no reconstruiría su «apoderado/oficio». | `datosFijos` vive **en cada versión inmutable**. |
| X-5 ✅ | «Un documento por empresa» (D4). | Con la regla de D12, **25 empresas** tienen naves en más de un parque. | **D13**: sin restricción de parque; `parque` se redacta con uno o varios nombres; cada nave conserva su parque. (Se **revirtió** mi propuesta «empresa + parque».) |
| X-6 | Respetar el patrón RLS de `kvaNaveDocs` (§5.9). | `kvaNaveDocs` tiene política `FOR ALL TO authenticated USING (true)` y `anon`/`authenticated` conservan todos los GRANT: acceso directo vía PostgREST saltando el RBAC. El proyecto ya usa otro patrón (`v2_invitaciones`…: **RLS sin políticas + `REVOKE ALL`**). | Tablas nuevas con el patrón **estricto**. Desviación consciente (regla 3). |
| X-7 | (Encargo) «hay puppeteer/jspdf/exceljs en package.json». | `apps/api` solo tiene `exceljs` y `pdf-parse`; `jspdf` está en `apps/web` (cliente); puppeteer no existe. `Dockerfile` = `node:22-slim` sin Chromium ni fuentes. | Motor nuevo en servidor: `pdfmake` (D-3). |
| X-8 | Campos del catálogo (§7). | Se agrega `naves_etiqueta` («nave»/«naves»). | Catálogo cerrado de 7 claves + 5 datos fijos. |
| X-9 | La baja del expediente la hace el 723. | `POST /kvas/documento/:idDoc/baja` actúa sobre **cada fila** de `kvaNaveDocs`; con un PDF compartido por varias naves dejaría el documento generado incompleto. | `bajaDocumentoNave` rechaza con 409 las filas de un documento generado (3 líneas en `kvas.service.ts`). |
| **X-10** | D12 (brief): naves elegibles = las que la empresa tiene como dueña **o** arrendataria. | La regla del tablero (`KvasService.ocupantesDeNaves`) es «arrendatario manda, si no el dueño». **D12 es la unión**: en BD actual **96 naves aparecen en las listas de 2 empresas** (dueño y arrendatario distintos), 1 caso donde la misma empresa es ambos (`rol = AMBOS`). | `kva_naves_elegibles` implementa la **unión** (no la regla del tablero). Un documento por empresa; la misma nave puede tener documentos vivos a nombre de dueño y de arrendatario (es lo esperado). |
| **X-11** | Brief §5.1: «el servidor sustituye los campos desde la BD, nunca con datos del cliente»; §5.6: «una nave sin KVA asignados/dotados no es seleccionable». | **D10** hace que **`kvas_por_nave` y `nivel` sean datos declarados por el usuario** (prellenados desde la dotación) y que **no se bloquee por dotación 0**. | La regla 1 aplica a `empresa`, `parque`, `naves`, `naves_etiqueta` (BD) y `fecha`; la **cantidad y el nivel por nave son entrada validada** (Zod: rango y decimales), quedan en `camposResueltos`, en la puente y en `contenidoFinal` (auditados). **El brief §5.1 y §5.6 deben actualizarse** (Toribio). |
| **X-12** | D11: «mismo logo configurado en la BD, `configuracionApi.getLogos`». | Los logos viven en `SPHConfiguraciones` (`LOGO_FONDO_CLARO` = **JPG**, 400 px de ancho; `LOGO_FONDO_OSCURO` = PNG) y en el bucket **público** `branding` (límite 2 MB; admite PNG/JPEG/SVG/WebP). **`pdfmake` solo admite PNG y JPEG** (no SVG ni WebP). | D-3 define obtención, formatos, tope y respaldo. |

## 1. Decisiones de Jereff incorporadas y preguntas nuevas

| Decisión | Dónde se refleja |
|---|---|
| **D10** cantidad declarada, prellenada desde `naves.dotacionBt/Mt`, nunca bloqueada | D-5, §3.3, 05 §4.3-4.4 |
| **D11** logo y membrete en el PDF | D-3, 05 §7 |
| **D12** empresa = dueño o arrendatario (unión) | D-6, X-10, 05 SQL `kva_naves_elegibles` |
| **D13** naves de uno o varios parques; `parque` con 1..n nombres | D-7, 05 SQL (sin restricción de parque), S-4 |
| **D14 / P-2 / P-3** sin `figura`; `DEVOLUCION` sin campos propios | catálogo de 7 claves |
| **P-6** redacción aprobada | §3.5 (texto por defecto, editable en la vista previa) |

**Preguntas NUEVAS (no bloquean el diseño):**
| # | Pregunta | Recomendación |
|---|---|---|
| **N-1** | ¿Qué lleva el **membrete** además del logo? Hoy no hay en la BD razón social, domicilio ni teléfono de la plataforma/empresa emisora (solo `LOGO_*`, `FAVICON_URL`). | Solo el logo arriba a la izquierda y una línea de pie con la fecha de generación y el folio del documento. Si quieren razón social/domicilio, se agregan como parámetros de configuración (cambio de datos: lo decide Toribio con Jereff). |
| **N-2** | Si el logo configurado un día es **SVG o WebP**, el PDF sale sin imagen (el motor no los soporta) y la vista previa avisa. ¿Aceptan que en Configuración se pida PNG/JPG para el logo de «fondo claro»? | Sí. Hoy ya es JPG, no hay impacto. |

## 2. Dónde encaja

No nace un módulo de API aislado: se agrega **un controlador y un servicio** dentro de `ParquesModule`, junto a KVA's.

```
apps/api/src/modules/parques/
  ├── kvas.service.ts                  ← +3 líneas: bajaDocumentoNave rechaza filas de documento generado (X-9)
  ├── kvas-plantillas.controller.ts    ← NUEVO  /kvas/plantillas…  (CRUD, versiones)
  ├── kvas-documentos.controller.ts    ← NUEVO  /kvas/documentos…  (empresas, naves, vista previa, generar, baja)
  ├── kvas-plantillas.service.ts       ← NUEVO  CRUD + versiones + concurrencia
  ├── kvas-documentos.service.ts       ← NUEVO  resolución de campos + orquestación de «generar»
  ├── kvas-plantillas.schemas.ts       ← NUEVO  Zod: contenido, datos fijos, catálogo, bodies
  ├── kvas-plantillas.campos.ts        ← NUEVO  catálogo cerrado + redacción (naves, kvas, nivel, fecha)  [puro, con tests]
  ├── kvas-pdf.service.ts              ← NUEVO  contenido saneado → PDF (pdfmake)
  └── kvas-logo-pdf.service.ts         ← NUEVO  logo de la plataforma (D11): ConfiguracionService → descarga segura → Buffer PNG/JPEG
apps/api/src/common/utils/archivo-seguro.ts   ← se REUSA (contenidoCoincide, rutaSegura, LIMITE_ARCHIVO); sin cambios
apps/web/src/features/permisos/permisos-descripciones.ts  ← +3 descripciones (724, 730, 731)
apps/web/src/components/layout/menu.tsx       ← +ítem «Plantillas» (clave 730) bajo Parques
packages/types/src/database.types.ts          ← regenerar tras aplicar la migración
```

Frontera de confianza: el front sigue hablando solo con el API; **no hay llave nueva**; el PDF nace en el servidor.

## 3. Decisiones técnicas

### D-1 · Esquema: cabecera + versiones inmutables + documento generado + tabla puente
Detalle y SQL en `05-BACKEND.md` §2. Por qué cuatro tablas y no dos:
- **Cabecera** `kvaPlantillas` (mutable solo en nombre/versión vigente/baja) y **versiones** `kvaPlantillaVersiones` (inmutables por trigger): una fila por guardado. Un documento generado referencia `(idPlantilla, version)` con FK compuesta → imposible apuntar a una versión que no existe.
- **`kvaDocGenerados`**: el documento. Inmutable salvo los campos de baja (trigger de guardia).
- **`kvaDocGeneradoNaves`** (tabla puente): una fila por nave incluida, con la cantidad de KVA usada (snapshot) y el `idDoc` de su fila en `kvaNaveDocs`. Se prefiere a un `jsonb` de naves porque permite «¿qué documentos generados tiene la nave X?» con índice, y a una columna nueva en `kvaNaveDocs` porque **no se altera una tabla existente en producción**.

### D-2 · Operaciones multi-tabla en funciones SQL, no en secuencias de llamadas del cliente
`supabase-js`/PostgREST **no tiene transacciones multi-sentencia**: un `insert` en 3 tablas desde Node deja estados a medias si algo falla entre una y otra. El código actual lo resuelve con compensación solo para «archivo + 1 fila» (`kvas.service.ts:865-891`). Aquí son N filas + archivo, así que **la parte SQL va en funciones `plpgsql`** invocadas con `comoActor(uid)` (para que `fn_auditoria` capture al actor, `supabase.service.ts:78`):
`kva_plantilla_crear`, `kva_plantilla_guardar` (bloqueo optimista, §7), `kva_documento_registrar` (todo-o-nada), `kva_documento_baja` (baja del documento **y** de sus filas del expediente), y la función de lectura `kva_naves_elegibles` (fuente única de la regla empresa↔nave, D-6).
⛔ Las funciones de `public` son ejecutables por `anon`/`authenticated` **por defecto** (verificado: `proacl` de `pagos_arrendatarios` incluye `=X` PUBLIC, `anon`, `authenticated`; hay antecedente `2026-09-07-fideicomiso-revoke-8-rpc-anon.sql`). Cada función nueva lleva `REVOKE … FROM PUBLIC, anon, authenticated; GRANT … TO service_role`.

### D-3 · Motor de PDF: `pdfmake` (JS puro, en proceso). **No Chromium.**
| Opción | Evidencia | Veredicto |
|---|---|---|
| Puppeteer/Chromium | No está en el repo. `Dockerfile` = `node:22-slim` sin Chromium, **sin fuentes del sistema** (los acentos saldrían como cuadros). Habría que `apt-get install chromium fonts-*` (~+400 MB de imagen, ~300-500 MB de RAM por render, flags `--no-sandbox` en contenedor, riesgo de procesos huérfanos, y si el HTML trajera una URL, SSRF). | ❌ Desproporcionado para una carta de 1-2 páginas con 6 campos. |
| `jspdf` (ya en el repo) | Solo en `apps/web`; corre en el navegador. | ❌ Violaría la regla 1 (datos del cliente). |
| **`pdfmake` 0.3.x** (registro npm: `0.3.11`, depende solo de `pdfkit` + `linebreak` + `xmldoc`) | JS puro, sin binarios nativos → compila en `node:22-slim` sin tocar el `Dockerfile` (`pnpm deploy --prod` ya lo empaqueta). Describe el documento como datos (JSON) → **mapea 1:1 con el árbol saneado**, sin HTML intermedio. Trae Roboto (acentos y ñ). Soporta párrafos, negritas/cursivas/subrayado, listas, alineación, encabezado/pie. | ✅ **Recomendado.** |
| `pdfkit` directo | Lo mismo que pdfmake pero hay que hacer el layout a mano (saltos de página, listas). | ➖ Reserva. |
- **Cómo se invoca**: `KvasPdfService.render(modelo): Promise<Buffer>` — función pura sobre el árbol saneado ya con los campos resueltos. No lee la BD ni la red: el logo lo carga **antes** `LogoPdfService` (abajo) y se pasa como `Buffer`.
- **Logo y membrete (D11)** — `LogoPdfService.obtener(): Promise<{ buffer, ancho } | null>`:
  1. **De dónde**: `ConfiguracionService.obtenerLogos()` (`ConfiguracionModule` es `@Global`, se inyecta directo; es la misma fuente que `configuracionApi.getLogos` del front: parámetros `LOGO_FONDO_CLARO` / `LOGO_FONDO_OSCURO` de `SPHConfiguraciones`). Se usa **`claro`** (el papel es blanco; hoy es un **JPG**, `ancho: 400`, en el bucket público `branding`).
  2. **Descarga segura**: la URL **sale de la BD, no del cliente**, pero se exige que empiece por `${SUPABASE_URL}/storage/v1/object/public/branding/` (si no, se ignora: defensa ante SSRF si alguien con permiso de Configuración pusiera otra URL). `fetch` con timeout de 5 s, sin seguir redirecciones, **tope 2 MB** (el del bucket) y comprobación de **magic bytes** con `contenidoCoincide(buf,'png'|'jpg')` de `archivo-seguro.ts`.
  3. **Formatos admitidos por el PDF: PNG y JPEG.** `pdfmake` no soporta SVG ni WebP (X-12). Si el logo configurado es otro formato, se trata como «sin logo».
  4. **Tamaño en la página**: encaja en un cuadro de **150 × 60 pt** conservando proporción (`fit`), alineado a la izquierda en el encabezado de la primera página; el `ancho` de configuración (400 px) solo orienta, no se confía como medida.
  5. **Caché** en memoria de proceso por URL (la URL lleva `?v=<timestamp>` que cambia al reemplazar el logo, así que se invalida sola); TTL 10 min.
  6. **Sin logo configurado / formato no soportado / descarga fallida**: **el PDF se genera igual** con membrete sin imagen (solo la línea de pie), la vista previa devuelve la advertencia `LOGO_NO_DISPONIBLE` y se registra en el `Logger`. No se bloquea la generación (misma filosofía que D10).
  7. **Membrete**: encabezado = logo; pie = «Documento generado el dd/mm/aaaa · Folio {primeros 8 de idDocGenerado} · pág. n de m». El texto adicional del membrete (razón social, domicilio) **no existe en la BD**: pregunta N-1.
- **Bloqueo / timeout / tamaño** (el brief §5.8 pide «sin bloquear»): una carta de 1-2 páginas son decenas de ms de CPU, así que **no justifica cola ni worker** hoy (≈ decenas de documentos al mes: 313 empresas con naves hoy, máx. 12 naves por empresa). Aun así se acota: (1) **semáforo en proceso de 2 renders simultáneos** (los demás esperan ≤ 10 s o reciben 503 «intenta de nuevo»); (2) **timeout de 10 s** con `Promise.race` y 504 genérico; (3) **PDF ≤ 2 MB** y **≤ 10 páginas** (se cuentan los `/Type /Page` del buffer) → 422; (4) los límites de contenido de §5 impiden un documento enorme. Si el volumen creciera, el salto natural es `worker_threads` (no se hace ahora: sería código sin evidencia de necesidad).
- **Por qué NO con datos del cliente** (regla 1, matizada por D10 — ver X-11): el cliente puede enviar `contenido` (texto libre, hostil por definición) pero **nunca valores de `empresa`, `parque`, `naves`, `naves_etiqueta` ni `fecha` ya resueltos**. Los nodos `campo` solo llevan una `clave` del catálogo; el servidor lee la BD, resuelve el valor y lo inyecta. Si el cliente mandara «empresa: X» el documento podría llevar la razón social de otra empresa o una nave ajena con membrete de la plataforma. **Única excepción, por decisión de negocio (D10): la cantidad de KVA y el nivel por nave** son entrada del usuario: se validan con Zod (rango, decimales, nivel ∈ {BT, MT}), y el **texto** («5 KVAS», «baja tensión») lo redacta siempre el servidor a partir de esos números. Además el servidor devuelve una `huellaCampos` en la vista previa y `generar` la recalcula: si cambió algo entre vista previa y generación → 409 (§7).
- **Fecha**: el servidor calcula «hoy» en `America/Mexico_City` (mismo criterio que `kvas-compromisos.scheduler.ts:52`) y la formatea con un arreglo de meses propio (no depende del ICU del contenedor).

### D-4 · Formato del contenido: **JSON de ProseMirror/Tiptap**, no HTML
| | JSON (elegido) | HTML |
|---|---|---|
| Validación | Estructural con Zod, `strict` (clave desconocida = rechazo) | Requiere un sanitizador (DOMPurify+jsdom / sanitize-html), dependencia nueva, y la lista permitida queda en configuración opaca |
| Campos del catálogo | Nodo atómico `campo {clave}` → verificable contra el catálogo | `<span data-campo="x">` → hay que parsear y confiar en atributos |
| Mapeo a PDF | Recorrido directo del árbol a `pdfmake` | Hay que parsear HTML a árbol primero |
| Superficie XSS | **Ninguna**: nunca se renderiza como HTML en el servidor; el editor del cliente (Tiptap con solo las extensiones permitidas) tampoco puede producir otros nodos | Alta si algún día se muestra con `dangerouslySetInnerHTML` |
Nodos y marcas permitidos, límites y Zod: §5 y `05-BACKEND.md` §3. Dependencia nueva **solo en `apps/web`** (`@tiptap/react` + extensiones puntuales); el API **no** depende de Tiptap (valida el JSON con su propio Zod). Hoy `apps/web/package.json` no tiene ningún editor de texto enriquecido.

### D-5 · KVA por nave: **declarada por el usuario (D10)**; `naves.dotacionBt/dotacionMt` solo prellena
**Regla D10:** al generar, **por cada nave elegida** el usuario confirma/teclea la cantidad y el nivel; el endpoint recibe `kvas: [{ nivel: 'BT'|'MT', cantidad }]` (1 o 2 entradas por nave) y **esa** cantidad es la que se redacta. **Nunca se bloquea por dotación 0** y se quitó cualquier bandera: es el comportamiento.
- **Prellenado** (lo calcula `GET …/naves`): `BT = naves.dotacionBt` si > 0 y `MT = naves.dotacionMt` si > 0; si ambas son 0 la nave llega **sin prellenado** (`kvasSugeridos: []`) y la interfaz pide teclearlo.
- **Por qué `dotacion*` y no `kvasAsignados` para prellenar** (consultas del 2026-10-07): 159 naves con dotación (149 solo BT, 2 solo MT, 8 ambas; valores BT: 5 y 10, sin decimales) contra 77 con asignación; en 75 de las 77 coinciden; 84 naves tienen dotación y ninguna asignación; las 85 asignaciones no traen empresa. Semántica en BD (`COMMENT`): «KVA que le corresponden a la nave por disposición del parque» = el «5 KVAS» típico.
- **Es dato declarado por el usuario.** El servidor no lo contrasta con la BD ni lo bloquea; sí lo **acota** (Zod: `cantidad` > 0, ≤ 100 000, máx. 2 decimales —cabe en `numeric(12,2)`—; sin duplicar nivel en una nave) y lo **deja auditado**: queda en `kvaDocGenerados."camposResueltos"` y `"contenidoFinal"`, y por nave en `kvaDocGeneradoNaves("kvasBt","kvasMt","origenKvas")`. `origenKvas` = `'DOTACION'` si el usuario dejó el valor prellenado y `'DECLARADO'` si lo cambió o lo tecleó (sirve para auditoría; no cambia el PDF).
- **Avisos informativos (no bloquean)** en la vista previa: `DIFIERE_DE_DOTACION` (declaró algo distinto a una dotación > 0) y `NAVE_CON_DOCUMENTO_VIGENTE` (la nave ya tiene un documento generado vivo del mismo tipo).
- **Efecto colateral: ninguno.** Generar el documento **no modifica** `naves.dotacion*` ni `kvasAsignados` (fuera de alcance: lo que se declara en la carta es la carta).

### D-6 · Regla empresa ↔ naves (D12: unión dueño ∪ arrendatario), una sola definición en SQL
`kvasAsignados` no trae empresa (hecho del brief §4 confirmado), así que la empresa se alcanza por la nave. **D12:** una empresa puede ser **dueña o arrendataria** de las naves de su documento, y sus naves elegibles son **todas** las que tiene como **arrendataria viva** (`arrenPropiedades.idArrendador`, `status = true`) **o como dueña viva** (`propiedades.idInversionista`, `status = true`). Ambas columnas apuntan a `inversionista`.
- **Es la unión**, no la regla del tablero (`KvasService.ocupantesDeNaves`, `kvas.service.ts:482-529`, «arrendatario manda, si no el dueño»): **96 naves hoy aparecen en las listas de dos empresas** (dueño y arrendatario distintos) y 1 empresa es ambas cosas de una misma nave (`rol = 'AMBOS'`). Es lo esperado por D12 (X-10). El tablero no cambia.
- Cada fila lleva `rol`: `ARRENDATARIO` | `INVERSIONISTA` | `AMBOS`, para que la interfaz lo muestre («Dueña» / «Arrendataria»).
- `propiedades.PActual` **se ignora** (el código actual de KVA's tampoco lo usa; 17 propiedades vivas con `PActual = false` son el único dueño de su nave). 414 de 636 naves activas tienen alguna empresa; 222 no (no seleccionables: no hay a nombre de quién emitir).
- Datos reales con esta regla: **510** pares empresa-nave, **313** empresas, **25 empresas con naves en más de un parque**, máximo **12** naves por empresa.
- Una sola función `kva_naves_elegibles(p_id_inversionista text)` (SQL, `STABLE`), usada por listado de empresas, listado de naves, vista previa, generación y —defensa en profundidad— `kva_documento_registrar`. Así «la nave pertenece a la empresa» no puede divergir entre servicio y BD.
- **Sin restricción de parque (D13):** la función **no** filtra por parque; el servicio tampoco. Cada nave conserva su `idParque` (el de `naves`, no el del cliente).

### D-7 · Redacción de campos (función pura, con pruebas)
Archivo `kvas-plantillas.campos.ts`. Entradas ya validadas; salida determinista.
- **`empresa`** = `razonsocial` (respaldo `NomComercial`, luego `nombre`, igual que `kvas.service.ts:520`). Hoy 0 vacías; 10 razones sociales duplicadas en minúsculas (la empresa se elige por `idInversionista`, no por nombre, y el selector muestra RFC).
- **`parque`** (D13: uno o varios) = los `nomParque` **distintos** de las naves elegidas (cada nave aporta el de su propio `naves.idParque`), recortados, ordenados alfabéticamente (`localeCompare('es')`) y unidos con `unirY`: «A», «A y B», «A, B y C».
- **`naves`**: tokens = `naves.numNaveNAME`. Es **texto**: 440 de 636 son enteros, **196 no** (A, B, «Alumbrado»…), y 9 llevan cero a la izquierda. Orden: primero los que cumplen `^[1-9][0-9]*$` por valor, luego el resto alfabético (`localeCompare('es')`). Rangos: **3 o más consecutivos** → «107-110» (guion); 1-2 se listan. Unión: «107-110 y 119-122», «1, 3-5 y 9». Los no numéricos y los de cero inicial **nunca** se agrupan.
- **`naves_etiqueta`**: «nave» si hay exactamente una, «naves» si hay más.
- **`kvas_por_nave`** y **`nivel`**: ver §3.5.
- **`fecha`**: «7 de octubre de 2026» (día sin cero, mes en minúsculas), editable (D9) en el rango de ±365 días respecto a hoy.

### D-8 · Resumen de las reglas del brief que se cumplen con mecanismo (no con intención)
| Regla del brief | Mecanismo |
|---|---|
| 1 Servidor arma el PDF | El body de `generar` no lleva valores de `empresa`/`parque`/`naves`/`fecha` resueltos; solo cantidades y niveles declarados (D10, validados) de los que el **servidor redacta el texto**; `KvasPdfService` solo recibe lo resuelto en servidor. |
| 2 Entrada hostil | Zod `strict` + lista permitida de nodos/marcas + claves de catálogo por tipo + límites (§5). |
| 3 Actor del JWT | Todas las escrituras con `comoActor(actor.uid)`; funciones SQL toman el uid de `request.jwt.claims`, no de un parámetro. |
| 4 Inmutable | Trigger de guardia en `kvaDocGenerados`; baja con motivo obligatorio (CHECK). |
| 5 Versionado | `kvaPlantillaVersiones` con trigger que prohíbe `UPDATE`/`DELETE`. |
| 6 Nave ∈ empresa (dueña o arrendataria, D12), en cualquier parque (D13); **sin bloqueo por dotación (D10)** | `kva_naves_elegibles` en servicio **y** dentro de `kva_documento_registrar`; el `idParque` de cada fila sale de `naves`, no del cliente. |
| 7 Ajuste no toca la plantilla | `generar` no escribe en `kvaPlantillas*`. |
| 8 Escalabilidad | Índices en cada FK, sin políticas RLS (costo cero), render acotado. |

## 3.5 Redacción de `kvas_por_nave` y `nivel` (P-6 aprobada)

Por nave, el usuario declara `kvas: [{ nivel, cantidad }]` (D10); de ahí salen las parejas `(bt, mt)` (formato «5», «2.5»; «1 KVA» si es 1, «N KVAS» en otro caso). **Es el texto por defecto**: en la vista previa el campo se puede **convertir en texto ordinario y editar** (el nodo `campo` pasa a nodo `text`; desde ahí es texto del usuario, saneado como cualquier otro).
| Situación entre las naves elegidas | `kvas_por_nave` | `nivel` | Advertencia |
|---|---|---|---|
| Todas iguales, **un solo nivel** (el caso del ejemplo: 8 naves × 5 BT) | `5 KVAS` | `baja tensión` (o `media tensión`) | — |
| Distinta cantidad, un solo nivel | `5 KVAS en las naves 107-110 y 10 KVAS en la nave 120` (grupos por cantidad, en orden de su primera nave) | `baja tensión` | — |
| Hay **algún nivel mezclado** (una nave con BT y MT, o naves con niveles distintos) | Por grupo, con nivel: `5 KVAS en baja tensión y 16 KVAS en media tensión en las naves 1-3; …` | `baja y media tensión` | `NIVEL_MIXTO`: la interfaz avisa «revisa la redacción». |
Una plantilla escrita como «…se asignan **{kvas_por_nave}** en **{nivel}**» lee bien en los dos primeros casos; en el tercero conviene ajustar el texto (la vista previa lo advierte).

## 3.6 Qué se consulta y cómo (sin N+1)

Todo con **una** llamada a SQL por pantalla, no por nave:
| Pantalla | Consulta |
|---|---|
| Selector de empresa (dueñas **y** arrendatarias, D12) | `rpc kva_naves_elegibles(NULL)` → agrega por empresa en Node (hoy 510 filas, 313 empresas) + un `select … from inversionista where idInversionista in (…)`. |
| Naves de la empresa (todas sus parques, D13) | `rpc kva_naves_elegibles(:emp)` (≤ 12 filas hoy) + `select idParque, nomParque from parques where idParque in (…)` + prellenado de KVA desde las columnas `dotacion*` que la misma función ya devuelve. |
| Vista previa / generar | `rpc kva_naves_elegibles(:emp)` filtrada a `idNave ∈ elegidas` + `select` de empresa y de parques. |
El `.range(0, 4999)` que usa todo el módulo (`kvas.service.ts:494`) evita el tope silencioso de 1000 filas de PostgREST; las funciones SQL devuelven `SETOF` y se pasan por `.range(0, 4999)` igualmente.

## 4. Permisos (resumen; texto y SQL en `05-BACKEND.md` §5)

Hoy, `segModulos.clave` ocupa 700-702, 710, 720-723, 800-801 en el rango 700-801 (consulta). **Libres y propuestas**:
| Clave | Sección / Área (`segModulos`) | Para qué |
|---|---|---|
| **724** | `Parques` / `KVA's` / `Generar documento` | Elegir una plantilla en KVA's, vista previa, generar el PDF y darlo de baja. |
| **730** | `Parques` / `Plantillas` / `Modulo` | Entrar a Parques → Plantillas, ver plantillas y su historial de versiones (y leerlas desde KVA's). |
| **731** | `Parques` / `Plantillas` / `Editar` | Crear plantillas, guardar versiones, restaurar una versión, dar de baja. |
**Por qué no reusar 721/723**: 721 es *asignar KVA* (cambia capacidad y dinero de CFE); 723 es *subir archivos al expediente*. Generar una carta es otro riesgo y se concede por separado. **D3** («editan ambos: quien administra y quien asigna») se cumple **otorgando 731 a los dos perfiles desde la pantalla de Permisos**: es dato, no código. **Soporte** pasa siempre `PermisoGuard` (`catUsers.isSupport`, `permiso.guard.ts:49-56`): ve y opera todo; sus escrituras salen con su `uid` (nunca suplanta).

## 5. Contenido del editor: esquema de saneamiento

**Nodos permitidos** (lista cerrada; todo lo demás = 400): `doc`, `paragraph` (attr `textAlign`: `left|center|right|justify`), `heading` (attr `level` 1-3), `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text`, **`campo`** (átomo, attr `clave` ∈ catálogo del tipo), **`datoFijo`** (átomo, attr `clave` ∈ las 5 claves de datos fijos).
**Marcas permitidas**: `bold`, `italic`, `underline`. **Sin** enlaces, imágenes, color, tamaños, fuentes, tablas ni HTML: el estilo del PDF lo fija el servidor (corporativo).
**Límites** (constantes en `kvas-plantillas.schemas.ts`):
| Límite | Valor | Motivo |
|---|---|---|
| Tamaño del JSON del contenido | 200 000 bytes | La carta real son ~3 KB; el body global admite 2 MB (`main.ts:23`), esto lo acota por endpoint. |
| Nodos totales | 2 000 | DoS por recorrido/render. |
| Profundidad | 6 | Listas anidadas razonables. |
| Texto total | 50 000 caracteres | ≈ 15 páginas. |
| Longitud de un nodo `text` | 5 000 | — |
| Datos fijos | `apoderado` 200 · `domicilio` 400 · `destinatario` 300 · `oficio` 80 · `solicitud_cfe` 80 caracteres, una línea | — |
| Nombre de plantilla | 1-120 · descripción ≤ 400 · nota de versión ≤ 200 · motivo de baja ≤ 400 (igual que `bajaDocumentoSchema`) | — |
Todo texto pasa por una normalización que **elimina caracteres de control, de ancho cero y los de reordenado bidireccional (U+202A-202E, U+2066-2069)**: en una carta legal permitirían que el texto se lea distinto de lo que contiene.

## 6. Seguridad — amenazas y mitigación

| # | Amenaza | Mitigación (dónde) |
|---|---|---|
| S-1 | **HTML/JSON inyectado** en el contenido (`<script>`, nodo desconocido, `attrs.href`, `__proto__`, clave extra) | Zod `strict` en cada nodo; lista permitida; el JSON nunca se interpreta como HTML (se mapea a objetos `pdfmake`); el PDF no ejecuta scripts. Se valida **al guardar la plantilla y otra vez al generar** (el body de `generar` trae contenido ajustado). |
| S-2 | **Campo fuera del catálogo** (`{{password}}`, `empresa_otra`) | `campo.clave` es `z.enum` del catálogo **del tipo** de la plantilla; un `DEVOLUCION` no acepta claves de otro tipo; un valor desconocido en la resolución lanza error (no se imprime «undefined»). |
| S-3 | **Nave de otra empresa** (IDOR por `idsNave`) | `kva_naves_elegibles(:emp)` es la única fuente; cualquier `idNave` fuera (ni dueña ni arrendataria viva de esa empresa) → **422 con mensaje único** («Alguna nave no corresponde a la empresa elegida») sin decir de quién es. Se repite dentro de `kva_documento_registrar` (cierra la carrera si cambió la tenencia). |
| S-4 | **Parque falsificado** (D13: ya no se envía `idParque`) | El cliente **no manda parque**: cada nave toma su `idParque` de `naves` (en el servicio y en SQL al insertar en `kvaNaveDocs`/puente). Un parque «inventado» no tiene dónde entrar. **Aviso honesto:** el RBAC de este ERP no segmenta por parque (`PermisoGuard` solo mira la clave, `permiso.guard.ts:60-67`), así que cualquier usuario con 720/724 ve todos los parques; no es una regresión, es el modelo actual. |
| S-5 | **Path traversal** en el archivo | La ruta **no contiene nada del cliente**: `rutaSegura(['plantillas', <uuid generado por el servidor>], 'pdf')` (`archivo-seguro.ts:90`). El nombre visible del PDF sale de la BD, no del body. |
| S-6 | **DoS por documento enorme** | Límites de §5 + semáforo de 2 renders + timeout 10 s + PDF ≤ 2 MB / ≤ 10 páginas + ≤ 50 naves por documento + `@Throttle` 10/min en `vista-previa-pdf` y `generar` (el global es 120/min, `app.module.ts:48`). |
| S-6b | **Cantidad declarada absurda o hostil** (D10: es entrada del usuario) | Zod: número finito > 0, ≤ 100 000, máx. 2 decimales, nivel ∈ {BT, MT}, sin repetir nivel por nave; el texto lo redacta el servidor (el usuario no inyecta texto por esta vía); queda auditada (`camposResueltos`, puente, `contenidoFinal`) con `origenKvas`; aviso informativo `DIFIERE_DE_DOTACION`. No hay efecto sobre `naves` ni `kvasAsignados`. |
| S-6c | **Logo/URL manipulada** (SSRF, archivo enorme o no-imagen) | Solo URL del bucket público `branding` del propio proyecto, sin redirecciones, 5 s, ≤ 2 MB, magic bytes PNG/JPEG; si no cumple → sin logo (D-3). |
| S-7 | **Doble clic / reintento** que crea dos documentos | `claveIdempotencia` (uuid del cliente) con índice único `(uidr, claveIdempotencia)` (§7). |
| S-8 | **Edición concurrente** que pisa la plantilla | Bloqueo optimista por versión (§7). |
| S-9 | **Alterar un documento ya emitido** | Trigger de guardia: solo cambian `status/motivoBaja/fechaBaja/uidBaja`; sin `DELETE`; sin reactivar. El `hashPdf` (SHA-256 de los bytes subidos) permite detectar manipulación del archivo en Storage. |
| S-10 | **Acceso directo a la tabla/función por PostgREST** con la llave `anon`/`authenticated` | RLS activa **sin políticas** + `REVOKE ALL` + `REVOKE EXECUTE` en las funciones (X-6, D-2). |
| S-11 | **Suplantación del actor** | `uidr`/`uidBaja` salen del JWT dentro de la función SQL (`request.jwt.claims`), no de un parámetro; sin actor → la función falla. |
| S-12 | **Fuga de errores de BD** | `fallaBd()` (`db-error.ts`); los `RAISE` con SQLSTATE propio (`KV404/KV409/KV410/KV422`) se traducen a 404/409/409/422 con texto de negocio redactado en el servicio, nunca `error.message`. |
| S-13 | **URL firmada** reutilizable | 1 h (`FIRMA_SEGUNDOS`), bucket privado `kvaDocs` (verificado `public = false`), se firma al leer con `firmarVarias` (una llamada para todas las rutas). |
| S-14 | **Texto que engaña** (bidi/ancho cero) | Normalización de §5. |
| S-15 | **Un editor sin permiso lee o edita** | Cada ruta con `@RequierePermiso` propio (§4 de `05-BACKEND.md`); el frontend solo oculta botones. |

## 7. Concurrencia, idempotencia y límites

- **Dos editores en la misma plantilla** — bloqueo optimista: `GET` devuelve `versionActual`; `PUT` exige `baseVersion`. `kva_plantilla_guardar` toma `SELECT … FOR UPDATE` de la cabecera y, si `versionActual ≠ baseVersion`, lanza `KV409` → **409 con la versión vigente y su contenido** para que la UI ofrezca «ver lo nuevo / guardar como otra versión sobre la nueva». Nunca se pierde el trabajo de nadie: las versiones anteriores quedan.
- **«Generar» con doble clic** — el cliente genera un `claveIdempotencia` (uuid) por apertura del modal. Servidor: (1) busca `(uidr, clave)`; si existe, devuelve ese documento (`200`, `repetido: true`) **sin** renderizar; (2) si no, un candado en memoria por `uid+clave` evita renderizar dos veces en la misma instancia; (3) la restricción única atrapa la carrera entre instancias → se borra el archivo recién subido y se devuelve el ganador.
- **Datos que cambian entre vista previa y generar** — la vista previa devuelve `huellaCampos` (SHA-256 del JSON canónico de los campos resueltos + naves + cantidades). `generar` la recalcula; si difiere → **409** con la vista previa nueva. Lo que el usuario vio es lo que se firma.
- **Límites**: ≤ 50 naves por documento (máximo real hoy por empresa: 12); contenido 200 KB; PDF 2 MB / 10 págs.; ≤ 200 plantillas vivas (CHECK blando en el servicio); ≤ 500 versiones por plantilla (el servicio avisa; las versiones son filas pequeñas).

## 8. Escalabilidad

| Tema | Decisión |
|---|---|
| **Índices** (Postgres **no** indexa FK solas) | `kvaPlantillas(tipo) WHERE status`; único parcial `(tipo, lower(btrim(nombre))) WHERE status`; `kvaDocGenerados(idInversionista, fc DESC)`, `(idPlantilla, version)` (sin índice por parque: D13 quitó `idParque` de la cabecera; el parque vive por nave en la puente); `kvaDocGeneradoNaves(idNave)` y `(idParque)` y `idDoc` único; las PK compuestas cubren `idDocGenerado` y `(idPlantilla, version)`. |
| **Índices en tablas existentes** (recomendado, **no incluido** — toca tablas compartidas, decide Toribio) | `arrenPropiedades` solo tiene índices en `status` y PK (**sin** `idNave` ni `idArrendador`); `propiedades` no tiene `idNave`. Con 148 y 363 filas vivas el escaneo es irrelevante hoy; se deja como bloque comentado en la migración para cuando crezcan. |
| **Tamaños** | Plantilla típica 3 KB; versión ≤ 200 KB; documento: contenido final + campos ≈ 4-8 KB + PDF de 30-100 KB en Storage. `fn_auditoria` guarda la fila completa en `auditoria` (`registro_nuevo`): el INSERT de una versión/documento duplica ese JSON una vez (solo se audita INSERT/UPDATE de baja; no hay edición de filas inmutables). Volumen esperado: cientos de filas al año. |
| **Caché** | Catálogo de campos: constante en código. Logo (D11): bytes en memoria del proceso por URL, TTL 10 min (la URL lleva `?v=` y se invalida sola al reemplazar el logo). Plantillas, empresas y naves: **sin caché** (cambian y son consultas de decenas de filas). |
| **RLS** | Sin políticas = costo cero por consulta (todas las lecturas son `service_role`). |
| **PDF** | En proceso, acotado (D-3). Sin trabajo en la petición más allá de decenas de ms. |
| **Listados** | Documentos generados: paginados (`limit` ≤ 100, orden `fc DESC`); URLs firmadas en lote. |

## 9. Impacto sobre lo existente

| Qué | Impacto | Mitigación |
|---|---|---|
| Tablas existentes | **Ninguna se altera.** Solo se leen `inversionista`, `propiedades`, `arrenPropiedades`, `naves`, `parques`; se **insertan** filas en `kvaNaveDocs` (vía función). | Migración solo-creación. |
| `kvas.service.ts` | `bajaDocumentoNave` +1 verificación (X-9). | Prueba de regresión del expediente (subir/baja manual sigue igual). |
| Expediente de la nave (`documentosDeNave`) | Las filas generadas aparecen con título «Asignación de carga — {empresa} — dd/mm/aaaa» y se firman con el mismo `firmarVarias` (la misma ruta se deduplica en el `Set`). | Sin cambio de código. |
| Bucket `kvaDocs` | Prefijo nuevo `yyyy-MM/plantillas/<uuid>.pdf`. | Sin cambio de bucket ni de política. |
| Permisos | 3 filas en `segModulos`; nadie las tiene hasta que Jereff las otorga. Soporte entra por `isSupport`. | — |
| Dependencias | **API:** `pdfmake` (+ `@types/pdfmake`). **Web:** Tiptap. | Revisión de licencias y de `pnpm audit` en el PR. |

## 10. Lo que NO se toca
`kvasAsignados`, dotación, devoluciones, acometidas, candado de liberación, el motor de saldo de KVA, `archivo-seguro.ts`, el resto del ERP, y el bucket/políticas de Storage.
