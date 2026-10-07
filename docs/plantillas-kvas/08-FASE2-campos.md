# 08 · Fase 2 — Campos automáticos (brief cerrado de construcción)

> Autor: Toribio (arquitecto), 2026-10-07. **Manda sobre 02/03/05 donde difieran** (concilia los hallazgos de los gates A/B/C).
> Alcance autorizado por Jereff: «dale fase 2». **Sin tablas nuevas, sin PDF de servidor, sin guardar en expediente** (eso es Fase 3).

## 1. Qué entrega
1. **Editor de plantillas:** el panel «Campos automáticos» deja de ser decorativo: un clic inserta un **campo** (chip verde, nodo atómico) donde esté el cursor. El catálogo viene del API.
2. **KVA's → «Generar documento»:** eliges plantilla → **empresa** → **naves** de esa empresa (agrupadas por parque; casilla + KVA + nivel por nave) → **«Ver documento»**: el **servidor** sustituye los campos y devuelve el documento ya redactado, que sigue siendo **editable**; se imprime con el navegador. No se guarda nada.
3. Decisiones de Jereff vigentes: D1–D18 de `00-brief-conceptual.md` (empresa = `inversionista.razonsocial`, dueño o arrendatario; KVA lo captura el usuario; varios parques permitidos; fecha automática; texto libre al ajustar; la vista previa no deja registro).

## 2. Catálogo de campos (lista CERRADA por tipo)
| clave | grupo (panel) | etiqueta | ejemplo |
|---|---|---|---|
| `empresa` | INVERSIONISTAS | Empresa | EM BAJÍO EMPAQUES S.A. DE C.V. |
| `parque` | PARQUES | Parque | Acupark III |
| `naves` | PROPIEDADES | Naves | 107, 108, 109, 110, 119, 120, 121 y 122 |
| `kvas_por_nave` | PROPIEDADES | KVA por nave | 5 KVAS |
| `nivel` | PROPIEDADES | Nivel de tensión | baja tensión |
| `fecha` | SISTEMA | Fecha | 7 de octubre de 2026 |
`ASIGNACION_CARGA` → los 6. `DEVOLUCION` → **ninguno** (no se pueden insertar ni guardar campos; el API rechaza con 400). `figura` NO existe (D14).

## 3. Redacción (funciones PURAS, con pruebas) — textos aprobados como propuesta, editables en la vista previa
Entrada: naves seleccionadas, cada una `{ idNave, numNave (texto), idParque, nomParque, kvas:[{nivel:'BT'|'MT', cantidad}] }`.
- **Dedupe por `idNave`** (el hallazgo B-A1: `numNaveNAME` NO es único; nunca deduplicar por número).
- Unión de lista: `a`, `a y b`, `a, b y c`.
- `empresa`: razón social tal cual.
- `fecha`: `D de <mes en minúscula> de AAAA` en zona `America/Mexico_City`.
- `parque`: nombres únicos en orden alfabético unidos con la regla de unión («A», «A y B», «A, B y C»).
- `naves`: ordenadas por parque (nombre) y luego por número (orden natural: 2 antes que 10; los no numéricos como `A12` al final por texto). **Un solo parque** → solo la lista de números: `107, 108 y 109` (sin rangos; el texto de la plantilla ya trae la palabra «Nave»). **Varios parques** → una porción por parque unidas con `; `: `107 y 108 del parque Acupark III; 12 del parque Spartek I`.
- `nivel`: todas BT → `baja tensión`; todas MT → `media tensión`; mezcla → `baja y media tensión` (+ advertencia `NIVEL_MIXTO`).
- `kvas_por_nave`: número formateado sin ceros sobrantes (`5`, `2.5`); si **todas** las naves tienen exactamente la misma cantidad (y un solo nivel por nave) → `5 KVAS` (singular `1 KVA`). Si difieren → agrupa por cantidad: `5 KVAS en las naves 107 y 108, y 10 KVAS en la nave 109` (una nave → «en la nave», varias → «en las naves»; cuidado con «y» doble: usa `; ` entre grupos cuando algún grupo ya contiene « y ») + advertencia `CANTIDADES_DISTINTAS`. Una nave con BT y MT a la vez → `3 KVAS en baja tensión y 2 KVAS en media tensión` (+ `NIVEL_MIXTO`).
- Advertencia `VARIOS_PARQUES` si hay más de un parque; `DIFIERE_DE_DOTACION` si la cantidad capturada ≠ la dotación de la nave (informativa; nunca bloquea).
- La **dotación solo prellena**: nunca bloquea (D10).

## 4. BD — migración SOLO de funciones de lectura (la aplica Toribio con autorización de Jereff; el agente NO la aplica)
`kva_naves_elegibles(p_id_inversionista text default null)` → `table("idInversionista" text, "idNave" text, rol text)`: **unión** de (a) dueño vivo = `propiedades` con `status` y sin baja (`motivoBaja` nulo o vacío; verifica en BD qué significa «vivo» comparándolo con cómo lo hace el tablero de KVA's/`kvas.service.ts` y con `05-BACKEND.md`) y (b) arrendatario vivo = `arrenPropiedades` con `status`; `rol` = `INVERSIONISTA` | `ARRENDATARIO` | `AMBOS` (misma empresa en ambos papeles de la misma nave). Si `p_id_inversionista` no es nulo, filtra. `STABLE`, `SET search_path = public`, `REVOKE ALL … FROM public, anon, authenticated`, `GRANT EXECUTE … TO service_role`. Archivo: `version2/base-conocimiento/migraciones/2026-10-07-kvas-naves-elegibles.sql` (idempotente, con verificación y rollback comentados; la versión borrador está en `05-BACKEND.md` — corrígela con lo que verifiques en la BD real; solo `SELECT` por `mcp__supaSPH__execute_sql`).

## 5. API (todo bajo el módulo `parques`; lectura = 721 | 730 | 731, igual que las plantillas; soporte pasa)
1. `GET /kvas/plantillas/catalogo/:tipo` → `{ tipo, campos:[{ clave, etiqueta, grupo, ejemplo }] }` (tipo ∈ lista fija; 400 si no).
2. `GET /kvas/documentos/empresas` → `[{ idInversionista, razonsocial, totalNaves }]`, solo empresas con ≥1 nave elegible, orden alfabético.
3. `GET /kvas/documentos/empresas/:idInversionista/naves` → `[{ idNave, numNave, idParque, nomParque, rol, dotacionBt, dotacionMt }]` ordenado por parque y número natural. 404 si la empresa no existe o no tiene naves elegibles.
4. `POST /kvas/documentos/vista-previa` body (Zod `.strict()`): `{ idPlantilla: uuid, idInversionista: string(≤40), naves: [{ idNave: string(≤40), kvas: [{ nivel:'BT'|'MT', cantidad: number }] }] }`; `naves` 1–200 sin repetir `idNave`; `kvas` 1–2 con niveles distintos; `cantidad` > 0, ≤ 100 000, ≤ 2 decimales. Respuesta `{ contenido:{ encabezado, cuerpo, pie, logoAncho? } , advertencias:[{ codigo, mensaje }], resueltos:{ empresa, parque, naves, kvas_por_nave, nivel, fecha } }` donde `contenido` es la versión VIGENTE de la plantilla **leída de la BD (el cliente NO manda contenido)** con cada nodo `campo` reemplazado por un nodo de texto con el valor resuelto y **las mismas marcas** que el campo. Errores: 400 · 404 plantilla · 409 `PLANTILLA_DE_BAJA` · 422 `PLANTILLA_SIN_CAMPOS` si el tipo es `DEVOLUCION` y la plantilla trae campos (no debería existir) · **422 `NAVE_NO_ELEGIBLE`** si ALGUNA nave no pertenece a la empresa (rechaza todo el documento; el candado se hace en el servidor con `kva_naves_elegibles(p_id_inversionista)`, nunca confiando en el cliente). Sin efectos: no escribe en la BD.
5. **Esquema del contenido (cambio en `kvas-plantillas.schemas.ts`)**: nodo inline `campo` `{ type:'campo', attrs:{ clave: enum(6 claves) }, marks?:[…mismas marcas permitidas] }` válido dentro de `paragraph.content`. En `crear` y `guardar`, el servicio verifica que las claves usadas ⊂ catálogo del `tipo` de la plantilla (en `guardar`, el tipo sale de la BD); si no, 400 `CAMPO_FUERA_DE_CATALOGO`. El saneado conserva `campo` (solo `clave` válida) y sus marcas. Los límites actuales (texto, nodos, profundidad) no cambian; cada `campo` cuenta como 1 nodo y 0 de texto.
6. Códigos de error con la forma ya usada: `{ codigo, mensaje }` dentro de `message` (así los entrega el `AllExceptionsFilter`).

## 6. Frontend (`apps/web/src/features/plantillas/` y `features/parques/`)
1. **Nodo Tiptap `campo`**: inline, atómico, atributo `clave`, `renderHTML` → `<span data-campo="clave" class="campo-chip">…etiqueta…</span>` (chip verde #ecfccb / texto #3f6212, borde #8DBE2F), `parseHTML` por `data-campo`; se borra con Backspace como una pieza; admite negrita/cursiva/etc.; se registra en `extensiones()`. Si una clave no está en el catálogo local, se pinta gris con «⚠».
2. **Panel «Campos automáticos»** (`PanelCampos` en `PlantillaEditorPage.tsx`): lee `GET /kvas/plantillas/catalogo/:tipo`; los chips pasan a **habilitados** (clic = insertar en el editor activo `hoja.activo`, sin perder el foco ni la selección); deshabilitados si la hoja no es editable; para `DEVOLUCION`: «Este tipo aún no tiene campos». Quitar la leyenda «Próximamente».
3. **`contenidoInicial`** (plantilla nueva): sustituye los marcadores `[NOMBRE DE LA EMPRESA]`, `[NÚMEROS DE NAVE]`, `[CANTIDAD] KVAS en baja tensión`, `[PARQUE]` y la fecha `A ____ de ____ de 20____` por nodos `campo` (`empresa`, `naves`, `kvas_por_nave`+`nivel` como dos campos separados por « en », `parque`, `fecha`).
4. **Modal «Generar documento»** (`GenerarDocumentoModal.tsx`): pasos en una sola pantalla: (a) Plantilla (activas; solo `ASIGNACION_CARGA` por ahora); (b) Empresa (select con búsqueda por texto; `GET …/empresas`); (c) lista de naves de la empresa agrupada por parque (casilla + input numérico «KVA» prellenado con la dotación si > 0, vacío y obligatorio si es 0 + select de nivel Baja/Media prellenado con el nivel de la dotación mayor; «Marcar todas»); (d) botón **«Ver documento»** (deshabilitado hasta que haya ≥1 nave marcada con KVA válido) → `POST …/vista-previa` → muestra advertencias en una franja ámbar y la hoja editable (como hoy) con zoom/logo/fuentes; (e) «Imprimir / guardar PDF» como hoy (copia de impresión). Cambiar empresa/naves/KVA tras ver el documento exige volver a pulsar «Ver documento» y avisa que se pierden los ajustes manuales. Mantén el aviso «Versión preliminar: no se guarda en el expediente». Estados: cargando, vacío («Esta empresa no tiene naves»), error por 422 `NAVE_NO_ELEGIBLE` (mensaje claro).
5. Usa los componentes compartidos existentes (`Modal` en portal, etc.). Todo texto en español con acentos. Sin `any`.

## 7. Criterios de aceptación
- Insertar `empresa` en una plantilla, guardar, reabrir: el chip sigue ahí. Guardar una plantilla DEVOLUCION con un campo → 400.
- Vista previa con EM BAJÍO EMPAQUES y sus 8 naves (107–110, 119–122; KVA tecleado 5, BT): `naves` = `107, 108, 109, 110, 119, 120, 121 y 122`, `kvas_por_nave` = `5 KVAS`, `nivel` = `baja tensión`, `parque` = `Acupark III`, `empresa` = su razón social, `fecha` = hoy en español.
- Naves de otra empresa en el cuerpo → 422 `NAVE_NO_ELEGIBLE`. Cantidades distintas / mezcla BT-MT / varios parques → advertencias y textos del §3. Pruebas unitarias de las funciones puras con ≥ 15 casos (incluye `A12`, dos naves con el mismo `numNaveNAME` en el mismo parque, 1 nave, decimales, plurales).
- `pnpm typecheck` y `pnpm build` verdes; arranque real del API (`Nest application successfully started`, rutas nuevas mapeadas).
