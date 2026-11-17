# PLAN — Corrección del subtotal de las solicitudes PPD (v2, tras verificación adversarial)

> **Estado: PROPUESTO (2026-11-02). NADA APLICADO.** Pendiente del visto bueno de Jereff.
> Autor: Toribio (Sonnet 5.5). Verificación adversarial: 2 validadores Opus (lente datos / lente código),
> informes completos en los anexos `PLAN-correccion-subtotal-ppd--anexo-validacion-datos.md` y
> `...-codigo.md` (misma carpeta). Origen: reporte «las partidas Acupark II y III no actualizan sus saldos
> tras aplicar pagos». Pendiente relacionado del tablero: **#77** (apartado anual de facturas PPD).

## 1. Problema y causa raíz (verificado contra la BD real)

- «Consumido» (Configuraciones ▸ Cuentas) sale de `v_resumenPresupuesto`: `SUM(cxp.subtotal)` de las
  solicitudes en `idEstado=6` (comprometido: `idEstado=4`). `SUM` ignora los NULL.
- Desde **v2.14.0 (2026-06-10)** el módulo PPD inserta las parciales con `subtotal: null`
  (`ppd.service.ts:523`, `insertarParcial`). 174 solicitudes (144 pagadas, 24 aprobadas, 6 en estados 1/2/3;
  $36,365,650.17 con IVA) no suman al presupuesto. Además la función `cxp_autorizar_solicitud_pago` convierte
  NULL→0, así que el control de presupuesto nunca se activó para esos pagos.
- Las 174 son **facturas distintas, una fila por factura, cada una paga el 100 %** (no abonos reales).
  `cxp_ppd.subtotal` (SubTotal del CFDI, antes de retenciones) está lleno en todas: es la misma convención
  que las solicitudes normales (`solicitudes.service.ts:632`). 151 sin deducciones; 22 con retenciones
  ISR/IVA; 1 con deducción de 16.16 % sin explicar (folio 90699788-9CF2-46B5-AF10-F6401030EFFB; XML no
  accesible; error máximo $27,930, aceptable si se anota).
- Segunda vía de daño (hallazgo del validador de datos): `editar()` (`solicitudes.service.ts:664-690`) tras
  «Devolver» reescribe `subtotal` con 0 (`z.coerce.number().default(0)`): ya pasó en **3 filas**
  (`wULNpbpQUEWh9nh`, `rcJJWDUdp96u0JP`, `v627XjI1hrm5Z99`; sus facturas sí tienen subtotal 16,800 / 25,200 /
  11,200). Total a corregir: **177 filas** (174 NULL + 3 en 0).

## 2. Decisiones de Jereff (2026-11-02)

1. Llenar el campo **copiando** el subtotal de la factura PPD (no calculándolo) para las filas que pagan el 100 %.
2. Regla para parciales reales (cualquier monto, cualquier orden): cada pago consume del subtotal la misma
   proporción que paga del total; el pago que deja saldo 0 cierra con lo que falte (suma exacta).
3. El subtotal es **antes de retenciones** (el gasto sigue siendo la base completa).
4. **Apartado anual de facturas PPD** (diseño aparte, paquete en `docs/`): se aparta la base completa **al
   autorizar**; liberar saldo = SÍ (con motivo y registro); el pago toma siempre la partida de su factura y
   «reasignar factura» mueve factura+apartado. **Regla del cambio de año: PENDIENTE con contabilidad**
   (tablero #77, bloqueado).

## 3. Cambios

### 3.1 Datos (una sola transacción; después del código)
- Guardas que abortan si no cuadran: 174 filas NULL aptas (todas con `idCxpPPD`, maestro con `subtotal>0`,
  `|total−maestro.total|≤0.01`, una fila por maestro) y las 3 filas en 0 de la lista cerrada.
- `SET LOCAL lock_timeout='5s'; statement_timeout='60s'`. UPDATE de los NULL (ROW_COUNT=174); UPDATE de las
  3 por `idCxp` con `AND subtotal=0` (ROW_COUNT=3); `ALTER COLUMN subtotal SET NOT NULL`; COMMIT.
- Respaldo `(idCxp, subtotal)` de las 177 filas y reversa en `migraciones/`: primero `DROP NOT NULL`;
  restaurar solo filas con `subtotal = maestro.subtotal` (no pisar ediciones posteriores); las 3 vuelven a 0.
- Auditoría: `fn_auditoria` registrará `uid NULL, origen=3` (no hay JWT vía MCP): la migración documenta
  quién la aplicó, cuándo y la lista de `idCxp`. SQL exacto en el anexo de datos §(c).
- Triggers: verificado fila por fila que ninguno cambia columnas distintas de `subtotal` ni puede abortar.
  Prueba posterior: filas de `auditoria` con `cambios - 'subtotal' <> '{}'` = 0.

### 3.2 Código (`apps/api/src/modules/cxp/`)
- Archivo nuevo `ppd-subtotal.ts` con `subtotalParcial` **en centavos enteros y con objetivo acumulado**
  (versión final en el anexo de código §(c)); pruebas `ppd-subtotal.spec.ts` (9 casos; mientras no haya jest,
  `node --test`).
- `saldoDe` devuelve `subtotalFactura` y `subtotalAsignado` en **la misma lectura** que el saldo.
- `insertarParcial` recibe el subtotal (línea 523 deja de ser `null`); `crearConFactura` y `nuevaParcial` lo
  calculan; `ppd.schemas.ts`: monto con 2 decimales como máximo.
- `solicitudes.service.ts`: en filas con `idCxpPPD`, `editar()` solo cambia `idCategoria` y `concepto`
  (lo demás responde 400); `EditarSolicitudModal` bloquea monto y folio si `diferido`.
- Regenerar `packages/types/src/database.types.ts` tras el candado (que `subtotal: null` falle al compilar).
- Orden de despliegue: **código → datos+candado**. Recalcular las cifras de impacto el día de aplicar.

## 4. Hallazgos adicionales de la verificación (disposición de Jereff pendiente)

| # | Hallazgo (ya existía) | Ejemplo para el negocio | Estado |
|---|---|---|---|
| A | **El código v2 no respeta la convención de folio de v1.** Convención (confirmada por Jereff y por 28/28 pagos migrados de v1, 20/mar–9/jun/2026): `folio` = UUID de la factura + sufijo `-<día><mes><año>` sin ceros **tomado de `fecSolicitud`** (ej. `…-1252026` = 12/05/2026; verificado 28/28, no coincide con `fc` en 3 casos ni con `fecPago`), único por pago; la columna `idFolioDif` guarda el folio verdadero de la factura. Ejemplo real con 2 abonos: factura `0ACB93AC-F5CF-5777-9BB8-5950927EC57A` (maestro `migc073dd596c58`, total 12,528, numPagos 2): pagos `…-1252026` y `…-2252026` de 6,264 c/u. v2 (`ppd.service.ts:518-519`) escribe el UUID en **ambas** columnas, y como `cxp_folio_key` es UNIQUE(folio), una 2.ª parcial de la misma factura chocaría (no probado en vivo: no se escribe en producción). | Una factura de $1M que se quiera pagar en dos partes: el segundo pago no se puede capturar | verificado: índice, 178/178 pagos v2 sin sufijo (también los ya pagados), ningún trigger toca el folio, 0 facturas v2 con 2 pagos. Corrección propuesta: de la 2.ª parcial en adelante `UUID-<d><m><aaaa>` con la `fecSolicitud` del pago (consecutivo si se repite el día) y `idFolioDif` = UUID; la 1.ª conserva su folio (la detección de duplicados busca `cxp.folio = UUID`; la validación del REP usa el folio del maestro, no se afecta) |
| B | `eliminar()` borra del almacenamiento el XML/PDF de la parcial, que son los mismos de la factura maestra (203/205 comparten archivos) | Borrar un pago guardado borra la factura de la que sale | verificado en código; 2 parciales en Guardado hoy |
| C | «Devolver» una parcial rechazada (3→1) la revive sin revalidar el saldo | Una factura puede quedar con más pagos pedidos que su total | reportado, ver anexo código H4 |
| D | Las parciales PPD en Guardado no se pueden reenviar (`enviar()` exige CFDI del mes en curso) | Un pago regresado a Guardado queda atorado | reportado, anexo código H11 |
| E | Divisa: 1 parcial en USD ($2,900, 53-480-0) y 1 en «XXX» ($38,280) pasarán a sumarse como pesos | La partida cuenta dólares como pesos | requiere decisión de negocio |

Recomendación de Toribio: A, B y C **ahora** (sin A, los abonos reales —motivo de todo el diseño— no
funcionan; B pierde archivos; C rompe el saldo). Concurrencia de dos parciales simultáneas: verificación
posterior al insert (409 si `disponible < −0.01`) en el mismo cambio que A.

## 5. Veredictos de la verificación adversarial

- **Gate-Datos: APTO CON CONDICIONES**, 0 ALTA, 2 MEDIA (3 filas más; `editar()` degrada el subtotal),
  triggers sin efectos colaterales, candado barato (2,348 filas), ninguna aprobación pendiente cambia de
  resultado con el presupuesto de noviembre (53-480-0 queda con ≈$15.9k de margen).
- **Gate-Código: APTO CON CONDICIONES**, 2 ALTA preexistentes (folio único, borrado de archivos),
  fórmula correcta en pruebas (200k secuencias normales + 100k concurrentes + 100k con «Devolver»); la
  versión del plan fallaba en centavos (comparación en double) → versión en enteros. Seguridad: sin
  hallazgos nuevos (monto validado en servidor, escrituras con `comoActor`).
- Notas: la RPC `cxp_autorizar_solicitud_pago` usa la vista en minúsculas (`v_resumenpresupuesto`), idéntica
  a `"v_resumenPresupuesto"`: un cambio futuro debe hacerse en las dos. La KB `modulos/cxp.md:836-838` dice
  que `trigger_cxp_validar_fecha_insert` está desactivado y está **activo**: corregir al documentar.

## 6. Fuera de alcance de este plan (registrados aparte)
35 Urgentes/Línea de Captura con subtotal 0 · apartado anual (#77). (Los 26 PPD «heredados» con subtotal 0
entran en la decisión D6 de §7, no están fuera.)

## 7. Segunda ronda de verificación (2 validadores Fable, con lo aprendido el 2026-11-02)

**Veredictos: ambos APTO CON CONDICIONES, 0 ALTA nuevas.** Informes completos en los anexos
`...--anexo-2da-ronda-datos.md` y `...--anexo-2da-ronda-codigo.md`. Código y pruebas ejecutables (27/27
pasan con `node --test`) en `temp/validacion2-subtotal-ppd/` (se mueven al repo al construir).
Confirmado con datos reales: 178/178 pagos al 100 % copian exacto el subtotal; 1,074/1,074 particiones
hipotéticas de 2–7 abonos sobre 179 facturas reales suman exacto. Relleno: hoy 174 NULL + 3 en 0 = 177;
triggers idénticos; ninguna partida cruza a «fuera de presupuesto»; 7 cambian de semáforo (53-480-0 a ALTO;
53-340-0, 53-550-0, 53-490-0, 53-450-0, 53-560-0 a MODERADO; 11-603-1 a BAJO).

**Correcciones a lo anterior:**
1. **El CFDI trae `Descuento` y `cfdi.ts:182` solo lee `SubTotal`.** Maestro `3953458D-…-318F`: subtotal
   25,200, total 21,924 = 25,200×0.75×1.16 → base real 18,900 (afecta la parcial `rcJJWDUdp96u0JP`).
   Folio `90699788-…-EFFB`: 27,885.24/1.16 = 24,039 → Descuento 3,891 (resuelve el «16.16 % sin explicar»).
   Las demás deducciones (0.9533 / 1.0408 / 1.0533 / 1.1475) son retenciones: no reducen la base. **D1.**
2. **Folio:** el sufijo sin ceros es ambiguo (1/11 = 11/1; 5 pares por año): el consecutivo es «si el folio
   YA EXISTE» (contando rechazadas y `status=false`, que ocupan `cxp_folio_key`), con reintento ante 23505.
   28 filas con sufijo = 27 con maestro + 1 huérfana (`tmKFnNmIt1RBr3d`). «Sufijo solo desde la 2.ª» sigue
   siendo lo correcto (no toca 178 folios ni 165 `movbancarios.folioCFDI`); ojo: «sin sufijo» ya no
   significa «primera parcial» (puede haber una rechazada antes). **D2.**
3. **Fecha en hora de México:** `ppd.service.ts:506,631` usan UTC (`toISOString`): de 18:00 a 24:00 la
   solicitud nace «mañana» (sufijo, `numSem`, mes). v1 usaba hora local. **D4.**
4. **Los 26 con subtotal 0 no son «de v1»:** la migración v2 del 2026-06-17 creó 25 maestros `mig…` sin
   leer el XML (`cxp.md:985-994`). Los XML existen (25/25) en el bucket privado `CFDIproveedores`; ÷1.16 es
   exacto en 22 pero falla en ANAHI SILVA y TUNECO (hasta $11,500): **prohibido estimar sin XML.**
   $4.96M hoy invisibles (estado 4: 8 filas $2,432,857.24; estado 6: 18 filas $2,529,179.03). **D6.**
5. **Pérdida real ya ocurrida:** maestro `EOAbGyyID3KJbAO` (NPXXIX, $26,100, 53-470-0): su única parcial se
   borró en julio y con ella el XML/PDF (verificado: 0 filas en `cxp`, 0 objetos en storage). **D5.**
6. **Para que un abono funcione de punta a punta** (además del folio): `nuevaParcial` da 500 en días no
   habilitados (sin precheck de periodo; noviembre tiene 0 días cargados en `cxp_fechas_habilitadas`);
   el REP que ampara 2 parcialidades de una factura no se puede registrar (UUID único por fila) **D3**;
   `asignarMovimiento` no valida el importe contra el total **D7**; `numPagos` desfasado en 4 maestros;
   `eliminar()` de la última parcial deja el maestro sin parciales **D5**; `enviar()` exige CFDI del mes.
7. **Divisa:** `IfXf7vkKbRWlY8X` (USD 2,900) y `JC3FjLXdjjw75Xy` (XXX 38,280): excluir del relleno. **D8.**
8. **Pruebas:** jest declarado y NO instalado (los 8 `.spec.ts` existentes nunca han corrido); runner =
   `node:test` (corre hoy con Node 22; lo decide Toribio).
9. El candado `SET NOT NULL` no detiene el modo de falla real (0 silencioso por DEFAULT/`editar()`): el
   candado efectivo es el código (cerrar `editar()`); el `NOT NULL` es defensa adicional barata.
10. KB a corregir al cierre: `cxp.md:836-838` (trigger de fecha activo), `:225-230` (bug del folio ya
    estaba como «latente»), convención del sufijo, origen real de los 26.

**Diseño final y orden** (detalle por archivo:línea en el anexo de código §(d)):
- **Fase 1 — imprescindible para el subtotal:** `ppd-subtotal.ts` + spec · `cfdi.descuento` (D1) · `saldoDe`
  (misma lectura) · `insertarParcial`/`crearConFactura`/`nuevaParcial` · monto a 2 decimales · `editar()` solo
  `idCategoria`/`concepto` en PPD (**las 3 filas en 0 fueron REASIGNACIONES DE PARTIDA vía Devolver+Editar:
  ese camino debe seguir permitiendo cambiar `idCategoria`**) · datos (177 filas, con las 2 de D1 y las 2
  de D8 resueltas) + `NOT NULL` + regenerar `database.types.ts`.
- **Fase 2 — para que los abonos funcionen:** folio v1 con reintento + hora de México · precheck de periodo y
  `mapearErrorCxp` + verificación posterior al insert (409) · `eliminar()` PPD sin borrar archivos + recuento
  de `numPagos` · `devolver()` 3→1 bloqueado en PPD · `enviar()` exento de «mes en curso» en PPD · y, según
  D3/D7/D5, REP compartido, validación de importe y maestro sin parciales.

**Decisiones de Jereff pendientes:** D1 base = SubTotal − Descuento · D2 formato del sufijo (con/sin ceros)
· D3 REP compartido · D4 hora de México · D5 maestro `EOAbGyyID3KJbAO` y maestros sin parciales · D6 recuperar
subtotal de los 26 leyendo sus XML (requiere credenciales de servidor) · D7 importe al asignar movimiento ·
D8 divisa en el relleno.
