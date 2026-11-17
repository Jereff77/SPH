# Validación adversarial — 2.ª ronda (Fabián-Código / Fable) — PLAN-correccion-subtotal-ppd

Fecha: 2026-11-02 · Lente: código / lógica / pruebas · BD solo SELECT (PG en UTC, `now()` 17:01Z) ·
Scripts y evidencia ejecutable: `temp/validacion2-subtotal-ppd/` (`ppd-subtotal.ts`, `prueba.test.mjs`,
`folio.test.mjs`, `datos-reales.mjs`, `facturas.json` = SELECT de las 204 facturas PPD con sus 205 pagos).
Resultado de las pruebas: **27/27 pasan** (`node --test prueba.test.mjs folio.test.mjs ppd-subtotal.spec.ts`).

## (a) VEREDICTO: **APTO CON CONDICIONES**

La fórmula del subtotal (centavos enteros, objetivo acumulado) es correcta contra los datos reales: **178/178**
pagos del 100 % copian exacto el subtotal del maestro y **1,074/1,074** particiones hipotéticas (2 a 7 abonos
sobre las 179 facturas reales con subtotal > 0, montos aleatorios con 2 decimales) suman exacto, 0 negativos,
desfase máximo 0 centavos. El relleno de datos no tiene hallazgos nuevos. **Pero el plan no se construye tal
cual** por cinco condiciones:

- **C1 (decisión de Jereff)** — El «SubTotal del CFDI» ignora el atributo `Descuento`: hay una factura real con
  descuento del 25 % exacto cuyo subtotal copiado sobrestima la base en $6,300 (H1).
- **C2** — El generador de folio del §4.A queda subespecificado: debe contar las filas rechazadas y
  `status=false`, reintentar ante `23505`, usar la fecha de México y manejar la ambigüedad del formato sin
  ceros (H4, H5).
- **C3** — `nuevaParcial` revienta con 500 genérico en cualquier día no habilitado (el trigger de fechas corre en
  el INSERT y `nuevaParcial` no consulta `cxp_puede_insertar` ni pasa por `mapearErrorCxp`) (H2).
- **C4 (decisión)** — Un REP que cubra dos parcialidades de la misma factura no se puede registrar: el UUID del
  REP es único por fila y `validarRepContra` suma todos los `ImpPagado` del folio (H3). Sin esto, los abonos
  reales se atoran en el último paso del flujo.
- **C5** — Las pruebas: jest está declarado y **no instalado** (0 binarios, 0 config); los 8 `.spec.ts` existentes
  usan globales de jest y **nunca corren**. Probado hoy: un `.spec.ts` con `node:test` corre con Node 22.21 sin
  flags (H9). Hay que decidir el runner antes de escribir `ppd-subtotal.spec.ts`.

Ningún hallazgo ALTA nuevo. Los dos ALTA de la 1.ª ronda (folio único, borrado de archivos) se confirman y
siguen siendo bloqueantes para los abonos, no para el relleno del subtotal.

## (b) Hallazgos (numerados, con evidencia)

### H1 · MEDIA — El parser ignora `Descuento`; «SubTotal del CFDI» sobrestima la base cuando hay descuento
- `cfdi.ts:182` lee `subtotal: num(root['@_SubTotal'])`; no existe ninguna lectura de `@_Descuento` en
  `apps/api/src` (grep: 0 resultados fuera del módulo de ventas). En CFDI 4.0, `Total = SubTotal − Descuento +
  Traslados − Retenciones`.
- Caso real: maestro `3953458D-F613-5865-A4DE-1A2E1DF7318F` (`UYuTcvExkxX1dp8`): `subtotal 25,200`, `total
  21,924`. `25,200 × 0.75 × 1.16 = 21,924.00` **exacto** (`datos-reales.mjs` → `descuentoSospechoso`): descuento
  del 25 % → base real **18,900**. Su parcial es `rcJJWDUdp96u0JP` (partida 52-210-0, pagada), una de las 3
  filas en 0 que el plan va a rellenar con 25,200: **+6,300** de gasto que no existe en una partida que la 1.ª
  ronda ya reporta excedida.
- Segundo caso: `90699788-…-EFFB` (`7Ls4PVOUab5CNRA`, 53-450-0): `27,885.24 / 1.16 = 24,039.00` entero exacto →
  consistente con `Descuento = 3,891.00` sobre SubTotal 27,930 (la 1.ª ronda lo dejó como «16.16 % sin
  explicar»). Sobreestimación: $3,891.
- Los otros 12 maestros con `subtotal·1.16 ≠ total` son retenciones (ratios 0.95333 = ISR 10 % + IVA 10.6667 %;
  1.04083 = RESICO; 1.05333 = solo IVA; 1.1475 = solo ISR 1.25 %): coherentes con la regla «antes de retenciones».
- **Corrección:** (i) Jereff decide si la base presupuestal es `SubTotal − Descuento` (yo lo recomiendo: «el gasto
  es la base completa» se refiere a retenciones, no a un descuento comercial que nunca se paga); (ii) `cfdi.ts`
  expone `descuento` y `crear()`/`crearConFactura` escriben la base acordada en `cxp.subtotal`/`cxp_ppd.subtotal`;
  (iii) el relleno trata las 2 filas con la cifra decidida (lista cerrada). Aplica igual a las solicitudes
  normales (`solicitudes.service.ts:632`): mismo bug, fuera de este alcance pero hay que decirlo.

### H2 · MEDIA (flujo de abonos) — `nuevaParcial` responde 500 genérico en días no habilitados y ante cualquier trigger
- `cxp_trigger_validar_fecha` (activo, `BEFORE INSERT OR UPDATE`) en INSERT exige `cxp_fechas_habilitadas.cfdi =
  true` para la fecha de México, salvo `esUrgente`. `crearConFactura` lo evita porque `validarCfdi` llama
  `cxp_puede_insertar` (paso 9, → 400 claro). `nuevaParcial` (`ppd.service.ts:696-757`) **no** lo consulta y
  `insertarParcial` (`:538-541`) solo loguea y lanza «No se pudo crear la solicitud parcial» (500), sin
  `mapearErrorCxp`. Hoy (noviembre) `cxp_fechas_habilitadas` tiene **0 días** cargados: cualquier «Solicitar otro
  pago» daría 500.
- **Corrección:** en `nuevaParcial`, antes del saldo: `if (!(await this.solicitudes.puedeInsertar()).habilitado)
  throw new BadRequestException('El periodo de captura está cerrado…')`; en `insertarParcial`, `mapearErrorCxp(error)`
  antes del 500 (como `aprobacion.service.ts:223`).

### H3 · MEDIA (flujo de abonos) — Un REP que ampara dos parcialidades de la misma factura no se puede registrar
- `subirComplemento` rechaza si el UUID del REP ya está en otra fila (`ppd.service.ts:830-838`) y
  `validarRepContra` (`cfdi.ts:430-453`) **suma todos** los `ImpPagado` del folio y los compara con
  `montoAplicado` de **una** parcialidad (±0.01). Si el proveedor emite un solo REP con dos `DoctoRelacionado`
  (dos pagos del mismo mes, caso normal del SAT: el REP es mensual), la 1.ª parcial falla por monto y la 2.ª por
  UUID duplicado. Hoy no se nota porque todas las facturas tienen 1 pago.
- **Corrección (decisión de diseño):** permitir el mismo `uuidComplemento` en varias filas **de la misma factura**
  (`idCxpPPD` igual) y validar el monto contra el `DoctoRelacionado` cuyo `NumParcialidad`/`ImpPagado` coincida
  con esta parcialidad, o contra la suma de parcialidades pagadas de la factura. Alternativa mínima: aceptar
  `ImpPagado` que coincida con el monto de **alguna** parcialidad pagada de la factura y reutilizar el REP.

### H4 · MEDIA — El generador de folio del plan §4.A necesita cuatro precisiones (probadas en `folio.test.mjs`)
- Formato verificado contra los 28 folios con sufijo de la BD (27 ligados a maestro + 1 huérfano `tmKFnNmIt1RBr3d`):
  `<UUID>-<d><m><aaaa>` sin ceros (`2026-06-02 → 262026`, `2026-05-12 → 1252026`). El sufijo es
  **ambiguo**: 5 pares reales de fechas por año producen el mismo texto (1/11 = 11/1, 1/12 = 11/2, 2/11 = 21/1,
  2/12 = 21/2, 3/11 = 31/1). El «consecutivo si se repite el día» del plan no basta como idea: tiene que ser
  «si el folio ya existe», por cualquier causa.
- `existentes` debe incluir **rechazadas y `status=false`**: siguen ocupando `cxp_folio_key`. Una 1.ª parcial
  rechazada conserva `folio = UUID`, así que la que la reemplaza lleva sufijo aunque sea la «primera viva».
  `saldoDe` filtra `status=true`; el generador no puede reutilizar esa lectura.
- Concurrencia: dos peticiones con la misma foto producen el mismo candidato (probado) → una recibe `23505` sobre
  `cxp_folio_key` → `insertarParcial` debe **recalcular con la foto fresca y reintentar** (máx. 3), no responder
  500. supabase-js expone `error.code`; mismo patrón que `pagos.service.ts:38-58`.
- Mayúsculas: 58 de 205 maestros tienen el UUID en minúsculas (`ppd_folio_lower=58`); el sufijo se concatena al
  folio del maestro **tal cual** (el índice es case-sensitive y la detección usa `.eq`).

### H5 · BAJA — `fecSolicitud` y el sufijo quedan en fecha UTC; v1 usaba la fecha local
- `insertarParcial:506` usa `new Date().toISOString().split('T')[0]` (UTC). Los 4 únicos pagos PPD con
  `fecSolicitud ≠ fc::date` son de v1 (p. ej. `S1ClgQP0SHrNtoB`: fc `2026-05-23 02:17Z`, fecSolicitud 22/05 →
  sufijo `-2252026`): v1 tomaba la fecha de México. En v2, después de las 18:00 (México) la parcial nace con la
  fecha de mañana (y `numSem`/`rangoSemana` del trigger `update_week_info` se corren con ella); el trigger de
  fechas y `cxp_puede_insertar` ya usan `America/Mexico_City`.
- **Corrección:** `hoyMexicoISO()` (en `ppd-subtotal.ts` propuesto) para `fecSolicitud` y para el sufijo, en el
  mismo valor. El mismo defecto existe en `solicitudes.service.ts:617,937` (fuera de alcance; decirlo).

### H6 · BAJA (abonos) — `asignarMovimiento` no valida que el importe coincida con el total de la parcialidad
- `registrarPago` sí lo exige (`pagos.service.ts:382`); `asignarMovimiento` (`:578-626`) acepta cualquier importe y
  escribe `montoAplicado = importe`. En PPD, `pagado` se calcula con `montoAplicado` y `disponible` con `total`:
  una parcial de 6,264 pagada con un movimiento de 6,000 deja la factura con disponible 0 y pagado 6,000 para
  siempre, y el REP (`montoEsperado = montoAplicado || total`) tendrá que decir 6,000.
- **Corrección:** misma validación ±0.01 que `registrarPago`, o decisión explícita de permitir diferencia.

### H7 · BAJA — `numPagos` ya está desfasado y nadie lo recalcula al rechazar/eliminar
- 4 maestros con `numPagos ≠ parciales activas` (`bc039684…`, `dc43297e…`, `f43c4a23…` con su única parcial
  rechazada y `numPagos=1`; `28ef1b27…` con **0 parciales** y `numPagos=1`). Solo `nuevaParcial` llama
  `actualizarContador`; `rechazar`, `devolver`, `eliminar` no. El front no lo usa (`numParcialidades` se calcula),
  así que es cosmético, pero el plan §4.B pide «recontar» en `eliminar()`: ojo con la **dependencia circular**
  (`PpdService` inyecta `SolicitudesService`; para que `eliminar()` recuente hay que mover `actualizarContador`
  a un helper sin servicio, p. ej. `ppd-contador.ts(db, idCxpPPD)`), no `forwardRef`.

### H8 · BAJA — Eliminar la única parcial deja un maestro sin parcialidades
- Caso ya existente: `28ef1b27-5d99-42e2-ac77-194c99a132f9` (0 parciales). Tras el fix de H2-1.ª ronda (no borrar
  archivos), `eliminar()` seguirá dejando el maestro: `analizar` dirá «ya registrada» y la única vía será
  «Solicitar otro pago» (funciona: disponible = total). Decidir si `eliminar()` de la última parcial borra
  también el maestro (y entonces sí sus archivos) o si se acepta el maestro «vacío».

### H9 · BAJA — Pruebas: jest no existe en el repo; `node:test` corre hoy
- `apps/api/package.json:13` `"test": "jest"`; no hay `jest`/`ts-jest`/`vitest` en ningún `package.json` ni en
  `node_modules/.bin`; no hay `jest.config`. Los 8 specs (`exigir-permiso.spec.ts`, `cobranza.service.spec.ts`,
  …) usan `describe/it/expect` globales → nunca han corrido. `supabase-falso.testing-spec.ts` es un cliente falso
  útil para una prueba de `insertarParcial` (folio + reintento) si se le agrega simulación de `23505`.
- Probado: `node --test ppd-subtotal.spec.ts` (import `./ppd-subtotal.ts`, `describe/it` de `node:test`) corre
  con Node 22.21 sin flags; el Dockerfile usa `node:22-slim`, `engines.node >= 22`. Los specs están excluidos de
  `tsconfig.json` y `tsconfig.build.json`, así que el sufijo `.ts` en el import no rompe build ni typecheck.
- **Corrección:** decidir runner. Mi recomendación: `"test": "node --test src/**/*.spec.ts"` para lo nuevo y
  registrar que los 8 specs viejos requieren migración (o instalar jest, decisión de Toribio).

### H10 · BAJA — La verificación posterior al insert (H8 de la 1.ª ronda) debe borrar también el comentario, y puede rechazar a las dos
- `insertarParcial` inserta `cxp` **y** `cxpComentarios` (`:542-549`). Si tras el insert `disponible < −0.01` y se
  borra la fila propia, hay que borrar su comentario (y `fn_auditoria` registrará INSERT+DELETE: aceptable). Si
  las dos peticiones concurrentes releen después de que ambas insertaron, **las dos** se borran y responden 409:
  seguro, pero el usuario reintenta a mano. Si se quiere evitar, la alternativa es `pg_advisory_xact_lock(hashtext(idCxpPPD))`
  en una RPC que lea saldo + inserte; no lo exijo para este cambio.

### H11 · BAJA — Divisa: la fila USD y la «XXX» pasan a sumarse como pesos (confirmo E del plan)
- `IfXf7vkKbRWlY8X` (USD 2,900, Guardado, 53-480-0) y `JC3FjLXdjjw75Xy` (XXX, 38,280, pagada). Recomiendo que el
  relleno **excluya** las filas con `moneda <> 'MXN'` (quedan en NULL hasta decidir conversión) en lugar de
  sumarlas mal; el candado `NOT NULL` entonces tendría que esperar o esas 2 filas recibir 0 con nota.

### Confirmaciones de la 1.ª ronda (todas verificadas contra código y BD)
- Folio único: `cxp_folio_key UNIQUE(folio)` sin filtro; 178/178 parciales v2 con `folio = cxp_ppd.folio`;
  205/205 con `idFolioDif = UUID`; 0 facturas v2 con 2 pagos; las únicas 2 con 2 pagos son `mig…` (v1).
- `eliminar()` borra `urlCFDI/urlXLM` (`solicitudes.service.ts:294-304`), compartidos con el maestro; 2 parciales
  PPD en Guardado hoy (`GrXZdM4LVCYzKMU`, `IfXf7vkKbRWlY8X`) con 🗑 habilitado (`SolicitudesPage.tsx:372`).
- `editar()` escribe `subtotal/total/folio/idProveedor/moneda/fecCFDI` del cliente (`:671-685`); el ✎ está
  habilitado para PPD (`tipoOperacion 1 < 4`, `SolicitudesPage.tsx:362`). **Dato nuevo de `auditoria`:** las 3
  filas que quedaron en 0 fueron **reasignaciones de partida** vía Devolver + Editar (`11-601-0 → 52-210-0` ×2 el
  2026-06-19 por el mismo uid; `11-602-3 → 11-601-1` el 2026-10-07). Es decir, «reasignar partida» de una PPD
  hoy se hace por ese camino: el candado de `editar()` **debe seguir permitiendo `idCategoria`** (el plan lo
  hace) y el front debe dejar claro que es la vía.
- `devolver()` 3→1 sin revalidar (`pendientes.service.ts:245`, permiso 450, sin verificación de dueño por diseño).
- `enviar()` exige CFDI del mes (`:326`), sin exención PPD; las 2 Guardadas tienen `fecCFDI` 2026-06-15 y
  2026-09-23 → atoradas. `editable()` no selecciona `diferido`; hay que agregarlo para exentar.
- `cxp_autorizar_solicitud_pago` convierte NULL→0 y usa `v_resumenPresupuesto` sin comillas (vista minúscula).
- Consumidores de `folio` con sufijo: `movbancarios.folioCFDI = cxp.folio` (`pagos.service.ts:430,602`) → ya hay
  11 movimientos v1 con sufijo; ninguna función/vista/trigger de BD lee `folioCFDI` (catálogo consultado).
  `cxp_get_estado_cuenta_detalle_v2` (Reportes) y `rep-pendientes.service.ts:75` proyectan `cxp.folio` tal cual
  (como v1). El REP valida contra `cxp_ppd.folio` (`ppd.service.ts:796-822`): no le afecta el sufijo. La
  detección de duplicado PUE busca `cxp.folio = UUID` (`:598-603`): sigue funcionando con «sufijo solo desde la
  2.ª». El agente de soporte consulta `cxp`/`cxp_ppd` por SQL acotado (`consultas.service.ts:57`): la KB ya
  documenta `idFolioDif` (`cxp.md:794`); el agente Montse (ventas) no toca `cxp`.

### Sufijo «solo desde la 2.ª» vs «en todas» (pregunta 2)
| Criterio | Solo desde la 2.ª (plan) | En todas |
|---|---|---|
| Compatibilidad con 178 filas v2 existentes | sin tocar nada | habría que reescribir 178 folios (y `movbancarios.folioCFDI` de 165) |
| Compatibilidad con v1 (`mig…`) | v1 **sí** ponía sufijo a la 1.ª (`…-1252026` fue la 1.ª de `0ACB93AC`) | igual a v1 |
| Detección «ya registrada como PUE» (`crearConFactura:598`) | funciona (PUE conserva UUID) | funciona (PUE conserva UUID) |
| REP / exportes / Montse | sin cambio | sin cambio (REP usa el maestro) |
| Riesgo | la «1.ª» rechazada deja el UUID ocupado: la siguiente lleva sufijo (inconsistencia cosmética) | ninguno adicional |
Veredicto: **«solo desde la 2.ª» es lo correcto para no tocar datos**; documentar que «sin sufijo» ya no
significa «primera parcial» (puede haber una rechazada antes).

## (c) Qué contradice o corrige de la 1.ª ronda y del plan
1. **Plan §1 / §2.3 («subtotal = SubTotal del CFDI»)**: incompleto cuando el CFDI trae `Descuento` (H1). La 1.ª
   ronda vio el 16.16 % «sin explicar» y lo dio por aceptable; hay un segundo caso con 25 % exacto y la cifra
   conjunta es $10,191, no $27,930 «máximo».
2. **Plan §4.A («fecSolicitud» como fuente del sufijo)**: correcto como regla, pero en v2 `fecSolicitud` es la
   fecha UTC y en v1 era la local (H5). Y «consecutivo si se repite el día» debe ser «si el folio existe» (H4).
3. **Plan §4.A («28/28 pagos migrados»)**: son 28 filas con sufijo, 27 con maestro; la 28.ª es la huérfana
   `tmKFnNmIt1RBr3d` (`diferido=true`, `idCxpPPD NULL`, rechazada). No cambia la convención.
4. **1.ª ronda, anexo código §(c) punto 4**: la verificación posterior al insert debe borrar también el
   comentario (H10) y `nuevaParcial` necesita el precheck de periodo (H2), que no está en la lista.
5. **1.ª ronda, H2 (recontar en `eliminar()`)**: implica dependencia circular; va en helper (H7).
6. **1.ª ronda, H12 / plan §3.2 («mientras no haya jest, node --test»)**: no es provisional, es el único runner
   que corre; hay que decidirlo (H9).
7. **Plan §4 tabla E (divisa)**: recomiendo excluir del relleno, no «sumar como pesos» (H11).
8. La fórmula, la migración de datos, los triggers y la seguridad de la 1.ª ronda: **sin correcciones**.

## (d) Diseño final y orden de cambios

### Código propuesto (`apps/api/src/modules/cxp/ppd-subtotal.ts`, probado: `temp/validacion2-subtotal-ppd/ppd-subtotal.ts`)
```ts
const aCentavos = (n: number): number => Math.round(n * 100);

export function subtotalParcial(
  factura: { subtotal: number | null; total: number | null },
  monto: number,
  saldo: { disponible: number; subtotalAsignado: number },
): number {
  const T = aCentavos(factura.total ?? 0), S = aCentavos(factura.subtotal ?? 0);
  if (!(T > 0) || !(S > 0)) return 0;
  const M = aCentavos(monto), D = aCentavos(saldo.disponible), Y = aCentavos(saldo.subtotalAsignado);
  const cierra = M >= D - 1;
  const objetivo = cierra ? S : Math.round((S * Math.min(T, T - D + M)) / T);
  return Math.max(0, objetivo - Y) / 100;
}

/** 12/05/2026 → "1252026" (día, mes, año sin ceros; 28/28 v1). */
export function sufijoFechaV1(fecISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecISO);
  if (!m) throw new Error(`Fecha inválida para el sufijo del folio: ${fecISO}`);
  return `${Number(m[3])}${Number(m[2])}${m[1]}`;
}

/** 1.ª parcial: UUID. Siguientes: UUID-<d><m><aaaa>, y -2, -3… si ya existe.
 *  `existentes` = TODOS los folios de la factura (incluye rechazadas y status=false). */
export function folioDeParcial(uuidFactura: string, fecSolicitudISO: string, existentes: Iterable<string>): string {
  const usados = new Set(existentes);
  if (usados.size === 0) return uuidFactura;
  const base = `${uuidFactura}-${sufijoFechaV1(fecSolicitudISO)}`;
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) { const c = `${base}-${n}`; if (!usados.has(c)) return c; }
  throw new Error('No se pudo generar un folio único para la parcialidad.');
}

/** yyyy-MM-dd de hoy en America/Mexico_City (alineado con cxp_puede_insertar). */
export function hoyMexicoISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
```

### Integración por archivo:línea
1. `ppd.service.ts:95-122` `saldoDe`: maestro `select('total, subtotal')`; parciales `select('total, subtotal,
   montoAplicado, idEstado')`; devolver además `subtotalFactura` y `subtotalAsignado` (Σ `subtotal ?? 0` de las
   no rechazadas, misma lectura). `SaldoPpd` (`:33-38`) gana dos campos; el front no se rompe.
2. `ppd.service.ts:489-551` `insertarParcial`: `p` recibe `subtotal: number`; `hoy = hoyMexicoISO()`;
   **nueva lectura** `select('folio').eq('idCxpPPD', ctx.idCxpPPD)` **sin filtro `status`** + `ctx.folio` si
   existe en `cxp` → `folio = folioDeParcial(ctx.folio, hoy, existentes)`; `:518 folio`, `:519 idFolioDif:
   ctx.folio`, `:523 subtotal: p.subtotal`. En el `error` del insert: si `code === '23505'` y el texto contiene
   `cxp_folio_key` → releer existentes y reintentar (máx. 3); si no, `mapearErrorCxp(error)` y luego el 500.
3. `ppd.service.ts:660-681` `crearConFactura`: `subtotal: subtotalParcial({ subtotal: <base decidida en H1>,
   total: cfdi.total }, dto.monto, { disponible: cfdi.total, subtotalAsignado: 0 })`; existentes = `[]` (ya
   verificó en `:598-603` que el UUID no está en `cxp`).
4. `ppd.service.ts:719-757` `nuevaParcial`: precheck `puedeInsertar()` → 400 (H2); `subtotal:
   subtotalParcial({ subtotal: saldo.subtotalFactura, total: saldo.total }, dto.monto, saldo)`; tras
   `actualizarContador`, releer `saldoDe`: si `disponible < −0.01` → borrar `cxpComentarios` y `cxp` propios,
   `ConflictException` (H10).
5. `ppd.schemas.ts:15-17`: `.refine(m => Math.abs(m*100 − Math.round(m*100)) < 1e-6, 'Máximo 2 decimales')`.
6. `cfdi.ts:182` + `CfdiData`: agregar `descuento: num(root['@_Descuento'])`; la base según la decisión H1
   (`solicitudes.service.ts:632` y `ppd.service.ts:645` escriben la misma base).
7. `solicitudes.service.ts:258-273` `editable()`: seleccionar también `idCxpPPD, diferido`. `:664-690` `editar()`:
   si `idCxpPPD`, actualizar **solo** `idCategoria` y `concepto`; cualquier otro campo distinto al de BD → 400
   («para cambiar el monto, elimine la parcialidad y solicite otro pago»). `:290-312` `eliminar()`: si
   `idCxpPPD`, no tocar storage y recontar `numPagos` vía helper sin servicio (H7). `:326` `enviar()`: exentar
   `diferido` del mes en curso (H11 de la 1.ª ronda).
8. `pendientes.service.ts:236-259` `devolver()`: seleccionar `idCxpPPD`; si `idCxpPPD && e === 3` → 400.
9. `ppd.service.ts:768-887` `subirComplemento` + `cfdi.ts:403-456`: REP compartido entre parcialidades de la
   misma factura (H3, según decisión).
10. `pagos.service.ts:578-626` `asignarMovimiento`: validar `|importe − total| ≤ 0.01` (H6, según decisión).
11. Front: `EditarSolicitudModal.tsx` deshabilita proveedor/folio/subtotal/total/fecha cuando
    `solicitud.diferido` (el tipo ya lo trae, `solicitudes.api.ts:14`); `NuevaParcialPpd.tsx` muestra el 409/400.
12. Tras el candado: regenerar `packages/types/src/database.types.ts` (`:2929/2986/3043`).
13. Pruebas: `apps/api/src/modules/cxp/ppd-subtotal.spec.ts` con `node:test` + `node:assert/strict` (los 25 casos
    de `prueba.test.mjs` + `folio.test.mjs`, importando `./ppd-subtotal.ts`); script `"test": "node --test
    src/**/*.spec.ts"` o la decisión de H9. Integración (con `supabase-falso` ampliado para `23505`): (i)
    `nuevaParcial` ×2 el mismo día → folios `-<sufijo>` y `-<sufijo>-2`; (ii) rechazada + reemplazo; (iii)
    precheck de periodo → 400; (iv) `editar()` PPD con `total` distinto → 400; (v) `devolver` 3→1 PPD → 400.

### Orden de cambios (alcance)
**Imprescindibles para el subtotal (i):** 1) `ppd-subtotal.ts` + spec · 2) decisión H1 y `cfdi.descuento` ·
3) `saldoDe` · 4) `insertarParcial`/`crearConFactura`/`nuevaParcial` (subtotal) · 5) `ppd.schemas` 2 decimales ·
6) `editar()` candado + front · 7) datos (relleno con las 2 filas de H1 y las 2 de divisa decididas) + `NOT NULL`
+ tipos. Verificación: 177 filas = maestro (o base decidida), `auditoria` sin claves ajenas a `subtotal`.

**Para que los abonos funcionen de punta a punta (ii):** 8) folio v1-compatible + reintento `23505` + hora
México (H4/H5) · 9) `nuevaParcial` precheck de periodo + `mapearErrorCxp` + verificación posterior (H2/H10) ·
10) `eliminar()` sin borrar archivos + recuento (1.ª ronda H2/H7) · 11) `devolver` 3→1 bloqueado (H4-1.ª) ·
12) `enviar()` exención PPD (H11-1.ª) · 13) REP compartido (H3, decisión) · 14) `asignarMovimiento` importe (H6,
decisión) · 15) maestro sin parciales (H8, decisión).

Sin (ii) el relleno queda correcto pero el sistema sigue sin poder abonar; con (i)+(8)+(9) ya se puede capturar
una 2.ª parcial y cobrarla; (13) decide si el REP de esos abonos se puede subir.
