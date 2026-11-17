# Validación adversarial · 2.ª ronda · lente DATOS / MIGRACIÓN / FOLIO — «Fabián-Datos» (Fable)

Fecha: 2026-11-02 17:00 UTC · Plan revisado: `version2/base-conocimiento/PLAN-correccion-subtotal-ppd.md` + anexos de la 1.ª ronda · BD solo lectura (SELECT / catálogo / `storage.objects` metadatos / `query_logs`). Sin escrituras, sin DDL, sin acceso a XML.

## (a) VEREDICTO: **APTO CON CONDICIONES**

- El **relleno de datos (§3.1)** está bien: conteos de hoy idénticos (174 NULL + 3 en 0 = 177), triggers sin cambio, ninguna aprobación pendiente cambia de resultado, ninguna partida cruza a «fuera de presupuesto». **0 hallazgos ALTA.**
- La **corrección del folio (hallazgo A)** tal como está redactada («consecutivo si repite el día») **falla en producción** en dos casos reales que nadie vio: el sufijo de v1 es **ambiguo** (5 pares de fechas distintas dan el mismo sufijo en 2026) y `fecSolicitud` en v2 se calcula en **UTC** (58/58 filas capturadas de 18:00 a 24:00 hora de México llevan la fecha del día siguiente). Son **MEDIA** y se corrigen en la especificación antes de construir.
- Los «26 heredados» **no** son PPD de v1: son solicitudes normales con `diferido=true` que la migración del 2026-06-17 convirtió en maestros `mig…` con `total = Σ parcialidades` y **sin leer el XML** (KB `cxp.md:985-994`). Sus **25 XML sí existen** en el bucket: el SubTotal exacto es recuperable; estimar ÷1.16 se equivoca hasta 17.8 % en los proveedores con retención.
- Un hallazgo B del plan (borrado de archivos) **ya ocurrió**: el maestro `EOAbGyyID3KJbAO` (factura `28ef1b27-…`, $26,100, 53-480-0) sigue vivo sin parcialidad y **sin XML ni PDF en el bucket**.

## (b) Hallazgos

### H1 · MEDIA — El sufijo «sin ceros» de v1 colisiona entre fechas distintas; la regla «consecutivo si repite el día» no basta
- **Evidencia:** `generate_series` 2026 → 365 días producen **360 sufijos distintos**. Pares que chocan: `1112026` = 11/01 y 01/11 · `1122026` = 11/02 y 01/12 · `2112026` = 21/01 y 02/11 · `2122026` = 21/02 y 02/12 · `3112026` = 31/01 y 03/11. Hoy (02/11/2026) es uno de ellos.
- Convención confirmada **28/28** (`folio = idFolioDif || '-' || día||mes||año` de `fecSolicitud` sin ceros; `ok_fecsol=true` en las 28; 3 no coinciden con `fc`: `P5Xui0l77vXmguA`, `Ws5LXcPfZhXiKPj`, `S1ClgQP0SHrNtoB`). Incluye la huérfana `tmKFnNmIt1RBr3d` (`-162026` = 01/06/2026). `movbancarios.folioCFDI` guarda 11 folios con sufijo (v1 también los escribió en la conciliación bancaria; `pagos.service.ts:430,602` hace lo mismo en v2).
- **Impacto:** dos parciales de la misma factura el 21/01 y el 02/11 (o una rechazada y su reemplazo el mismo día) → `23505 cxp_folio_key` → 500 «No se pudo crear la solicitud parcial». Exactamente el bug que se quiere matar.
- **Corrección:** el generador no debe razonar con fechas sino con **existencia**: `SELECT folio FROM cxp WHERE folio LIKE '<UUID>%'` (una lectura), elegir `UUID` si está libre, si no `UUID-<d><m><aaaa>`, si no `UUID-<d><m><aaaa>-2`, `-3`…; y **capturar 23505 y reintentar una vez** (carrera). Decisión de Jereff: mantener el formato v1 sin ceros (ambiguo, pero único por existencia) o pasar a `-ddmmaaaa` con ceros (las 28 filas de v1 no se tocan). Recomiendo **con ceros**: mismo significado, sin ambigüedad.

### H2 · MEDIA — `fecSolicitud` (y por tanto el sufijo) se calcula en UTC: de 18:00 a 24:00 hora de México es «mañana»
- **Evidencia:** `ppd.service.ts:506` y `:631` → `new Date().toISOString().split('T')[0]` (UTC). BD: `TimeZone = UTC`. De las filas `cxp` insertadas desde el 10/06/2026 entre 00:00 y 06:00 UTC: **58/58** tienen `fecSolicitud = fc::date` (UTC) y **0/58** la fecha de México. En PPD v2: 16 parciales en esa franja, 15 con fecha UTC (la excepción `ldKdWKfUDHfkMyB` es la fila v1 ligada a mano el 2026-06-23). v1 sí usaba hora local (`P5Xui…`: `fc` 04-22 00:21 UTC, `fecSolicitud` 04-21).
- **Impacto:** el sufijo del folio llevará la fecha equivocada en ~9 % de las capturas (16/178); además `numSem`/`rangoSemana` (trigger), el mes del estado de cuenta (`cxp_get_estado_cuenta_detalle_v2` filtra por `fecSolicitud`) y `cxp_trigger_validar_fecha` (fechas habilitadas) ya viven con ese corrimiento. Preexistente, fuera del plan, pero **el sufijo lo hereda**.
- **Corrección:** calcular `hoy` en `America/Mexico_City` (`Intl.DateTimeFormat('en-CA', { timeZone })` o `date-fns-tz`) en un helper compartido y usarlo en ambos `hoy` de `ppd.service.ts` (y en `solicitudes.service.ts` `filaBase`, mismo patrón). Mínimo obligatorio para este cambio: el sufijo.

### H3 · MEDIA — Los 26 «heredados» sí tienen fuente exacta del SubTotal (su XML) y el ÷1.16 se equivoca hasta 17.8 %
- **Qué son de verdad:** KB `cxp.md:985-994`: solicitudes normales marcadas `diferido=true` en v1; el 2026-06-17 se crearon **25 maestros `mig…`** con `total = Σ parcialidades no rechazadas`, **«no se leyó el XML»** → `cxp_ppd.subtotal = 0` en 25/25. No existe tabla con el SubTotal por UUID: `catFacturas.uuidCFDI/subtotalCFDI`, `facturasProveedor.folio`, `rgPdpDetalle/raPdpDetalle.uuidCFDI` → **0 coincidencias** para los 25 UUID. `cfdi_insertar_comprobante_completo` no escribe en ninguna tabla con ese dato (no hay tablas `cfdi*`).
- **Fuente real:** `storage.objects` (metadatos, bucket privado `CFDIproveedores`): **25/25 XML y 25/25 PDF existen** (p. ej. `2026-05/OCiDB24T034xLFD/1778621709659000.xml`). Toribio puede recuperar el `@_SubTotal` con el mismo parser (`cfdi.ts:182`) desde un script con credenciales de servidor; yo no accedí.
- **Por qué no estimar:** ratios reales `total/subtotal` en los 179 maestros v2: 1.1600 (154), **0.9533** (11, personas físicas con ISR 10 % + IVA ⅔), 1.0409/1.0408 (8, RESICO), 1.1475 (3), 0.9984, 1.0533, 0.8700. Por proveedor de los 26: PROCESOS ECOLÓGICOS GAMA (60 facturas, siempre 1.16), HOPI (17, 1.16), DE OLIVEIRA (22, 1.16), JAZA (12, 1.16), NEMESIS (8, 1.16), CARLOS SALVADOR RODRÍGUEZ (2, 1.16) → ÷1.16 sería exacto en 22 filas. **ANAHI SILVA SÁNCHEZ** tiene 0.9533 **y** 1.16 en sus otras facturas → sus 2 filas (15,602 y 49,010; 11-602-0) son ambiguas: 13,450/42,250 (÷1.16) contra 16,366/51,410 (÷0.9533), error hasta **$11,500**. **TUNECO** (mig56035e79540a): la 1.ª parcial `HUKywbyzFxxtg7o` sí trae subtotal **19,802.59** con total 17,228.25 (ratio 0.87, no estándar) → ÷1.16 daría 7,425.97 para la 2.ª parcial; por regla de cierre sería ≈ 9,901.30 si 19,802.59 es ⅔ del SubTotal, o **0** si 19,802.59 ya es el SubTotal completo del CFDI (v1 lo leía del XML en solicitudes normales). Solo el XML lo resuelve.
- **Tabla de los 26** (idCxp · maestro · folio · total · categoría · estado · ÷1.16):

| idCxp | idCxpPPD | folio | total | cat. | est. | ÷1.16 |
|---|---|---|---|---|---|---|
| P5Xui0l77vXmguA | mig56035e79540a | FDF6148D-…-2142026 | 8,614.125 | 52-210-0 | 6 | 7,425.97 (ver TUNECO) |
| Ws5LXcPfZhXiKPj | migc073dd596c58 | 0ACB93AC-…-1252026 | 6,264.00 | 11-602-0 | 6 | 5,400.00 |
| WVZFkWo0xasZKOa | migc073dd596c58 | 0ACB93AC-…-2252026 | 6,264.00 | 11-602-0 | 6 | 5,400.00 |
| qJXgpBv3lsS5dbi | mig4ddc8219b67d | 526661F0-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| YUKFBaaBW41OcxB | migebb70c0325c4 | 5DC7FC0E-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| msw0VLOryYVrTSD | mig54bce261e4ae | E005F359-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| r8Pv4Zki54AXdHF | mig90edb2466a91 | 4ECF47E9-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| CUFm1X6qrTeI1PK | migd1922d83d507 | 0B6CDD82-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| n2m6xgqavYRmXcO | mig2e4208779e21 | 3943FC44-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| s3VGIOVOsxizA32 | mige114ae9ee81a | 44CD989F-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| TPp7UVtdAIv9RRL | mig282a40af2504 | EE24C8F1-…-1252026 | 5,452.00 | 52-210-0 | 6 | 4,700.00 |
| Hu2soqEbYPn8HEi | mig9a3397fd40db | 323B4B49-…-2052026 | 13,740.62 | 52-210-0 | 4 | 11,845.36 |
| KGH1bJv60XgH9su | mig78ea833062b8 | C23C7BE1-…-2252026 | 5,452.00 | 52-210-0 | 4 | 4,700.00 |
| Adx800WuyDqfd6e | mig6cbfa911ca35 | 3DB692F1-…-2252026 | 27,260.00 | 52-210-0 | 4 | 23,500.00 |
| YSmS4WYo867R0AS | migfa5007eec277 | 4B344B12-…-2252026 | 13,740.62 | 52-210-0 | 4 | 11,845.36 |
| OFfVmMRBjxWlpPd | mig618d12c03cda | 5E55A137-…-2252026 | 19,952.00 | 52-210-0 | 4 | 17,200.00 |
| 34jYE3e46sRmihA | migbb20c3bf44a8 | CAC926B4-…-2252026 | 27,260.00 | 52-210-0 | 4 | 23,500.00 |
| e5MYkpMpJYoVIi6 | migc9acf260eed5 | F1D5A1B1-…-2252026 | 5,452.00 | 52-210-0 | 4 | 4,700.00 |
| S1ClgQP0SHrNtoB | mig063862f89329 | D6C8D9ED-…-2252026 | 48,598.20 | 53-480-0 | 6 | 41,895.00 |
| GXJ3jZwm9QEFiuM | migdf08a91f9b96 | 6CA6093E-…-2552026 | 2,320,000.00 | 11-603-0 | 4 | 2,000,000.00 |
| pDu4hZR9TTduVeg | mig307b7265e54b | 23A5AFF5-…-262026 | 3,318.89 | 53-340-0 | 6 | 2,861.11 |
| pYX0p98KEmGK8ao | migf002963de40a | 04CB5808-…-262026 | 191.31 | 53-340-0 | 6 | 164.92 |
| TPWggLpmvFXzt3K | migb4e577b58b5f | 910F24A6-…-362026 | 2,320,000.00 | 11-603-0 | 6 | 2,000,000.00 |
| dFHAlb6wpvtPCjm | mig110f5f1f374a | D2C97980-…-862026 | 15,602.00 | 11-602-0 | 6 | 13,450.00 (¿÷0.9533 = 16,366?) |
| R1Bo3RU7p7MgaTa | mige487f8ab2111 | 89EB626B-…-862026 | 49,010.00 | 11-602-0 | 6 | 42,250.00 (¿÷0.9533 = 51,410?) |
| SYNcn9Tue0S6i7A | mig57c4d5806bd0 | 20E25C26-…-962026 | 27,700.50 | 52-210-0 | 6 | 23,879.74 |

Totales: estado 4 → 8 filas, $2,432,857.24 (≈ $2,097,290.72 base); estado 6 → 18 filas, $2,529,179.03 (≈ $2,180,326.74 base). **$4.96 M con IVA que hoy no cuentan en ninguna partida.**
- **Corrección:** script de servidor que lea los 25 XML del bucket, parsee `SubTotal` con `cfdi.ts` y produzca `(idCxpPPD, subtotalXML, totalXML)`; comparar `totalXML` contra `cxp_ppd.total` (= Σ parcialidades) para detectar facturas pagadas parcialmente; rellenar maestro y parciales con la regla (100 % → copiar; mig56035e79540a y migc073dd596c58 → proporción/cierre). Mientras no se haga, **no** rellenar con ÷1.16.

### H4 · MEDIA — El hallazgo B del plan ya pasó: maestro vivo sin parcialidad y sin archivos
- **Evidencia:** `cxp_ppd.EOAbGyyID3KJbAO` (folio `28ef1b27-5d99-42e2-ac77-194c99a132f9`, $26,100, subtotal 22,500, `status=true`, `numPagos=1`) tiene **0 filas `cxp`**. `auditoria`: INSERT maestro+parcial `OxCxwbRRpN8XQpd` 2026-07-08; Devolver 2→1 el 07-13 07:52 («Colocar en presupuesto correcto»); `editar()` 07-13 15:25 (`subtotal null→0`, categoría 53-470-0→53-480-0); **DELETE** 07-13 15:27. `storage.objects`: `NPX2207015N5/28ef1b27-….xml` y `.pdf` → **0 objetos** (los borró `eliminar()`, `solicitudes.service.ts:290-304`). Es el acta notarial del fideicomiso BIM 85104441.
- **Impacto:** «Registrar factura PPD» con ese XML responde «ya está registrada, use Solicitar otro pago» (`ppd.service.ts:583-592`); «Solicitar otro pago» crearía una parcial que apunta a archivos inexistentes. La factura está **atorada** desde julio.
- **Corrección (decisión de Jereff):** dar de baja el maestro huérfano (`status=false`, auditado) para que la factura se vuelva a registrar con sus archivos, o re-subir XML/PDF al maestro. Confirma que B del plan va **ahora**, y que `eliminar()` también debe **borrar el maestro** si era su única parcialidad (o impedir borrar la última).

### H5 · BAJA — Hipótesis del índice: no es demostrable por logs, pero tampoco hace falta
- `query_logs` (ventana máxima 24 h): 0 errores `cxp_folio_key`; solo `correo_mensajes_dedup`. Los errores del API (`logger.error('Error creando parcial PPD…')`) viven en el host del API, no en Supabase. **No se puede concluir** si alguien lo intentó antes.
- `auditoria`: **ningún** maestro v2 tiene >1 INSERT de parcial (179 INSERT, 179 maestros v2 distintos). Los 3 rechazos (`ArJmRzio7SROFMu`, `3tW4ic3XZ1iUsFH` 2026-09-02; `xA0b3DSXcveru3r` «Se refactura» 2026-08-05) nunca recibieron reemplazo. El único «segundo insert» exitoso fue tras un DELETE (`YOdkrgf83u8hdGl`, 2026-06-16; luego el maestro se borró a mano, `origen=3`).
- Lo que sí es **determinista**: `cxp_folio_key UNIQUE(folio)` sin filtro + `insertarParcial` escribe `folio = m.folio` → 23505. No hay que probarlo en vivo. La KB ya lo registra como «Bug latente (PENDIENTE)» en `cxp.md:225-230`: el hallazgo A **no es nuevo**, estaba anotado y sin dueño.

### H6 · BAJA — Decisión de folio: (A) la del plan, con H1/H2 incorporados
| Opción | Qué cambia | Riesgo |
|---|---|---|
| **(A) Plan:** 1.ª parcial conserva `UUID`; siguientes `UUID-<sufijo>` por existencia; `idFolioDif=UUID` | Solo código. Las 178 filas actuales quedan como están. `crearConFactura:598` (`.eq('folio', uuid).limit(1)`) y `validarCfdi:491` (duplicado PUE) siguen funcionando porque la 1.ª parcial lleva el UUID | Convención mixta (v1: todas con sufijo). Si la 1.ª se borra y sobrevive una con sufijo, `enCxp` no la ve; lo cubre `existente` (maestro). **Recomendada** |
| (B) v1 pura: todas con sufijo | Reescribir `folio` en 178 filas (146 pagadas) y en `movbancarios.folioCFDI` de sus pagos; adaptar `:598` y `:491` a `idFolioDif` | Migración de datos sobre conciliación bancaria ya cerrada y 178 filas de auditoría; sin beneficio funcional. **Rechazar** |
| (C) Índice parcial `UNIQUE(folio) WHERE "idCxpPPD" IS NULL`, folio = UUID siempre | DDL en producción (`DROP CONSTRAINT` + índice); N parciales con folio idéntico en reportes, correos a proveedor (`complementos.scheduler`, `rep-pendientes`) y conciliación; v1 sigue con sufijo | Limpio para «el folio es el UUID», pero cambia lo que ve la gente y toca el esquema. Solo si Jereff prefiere folios idénticos |
- Consumidores revisados de `cxp.folio`: SQL → `cxp_get_estado_cuenta_detalle_v2` (lo proyecta), `lkr_cxp` (Looker, lo proyecta); ninguna función usa `idFolioDif`; ninguna vista/función usa `folioCFDI`; sin policies ni triggers sobre folio. API → `ppd.service.ts:437,587,598` (cxp_ppd/cxp por UUID), `solicitudes.service.ts:491,1071` (duplicados, con `limit(1)`), `pagos.service.ts:430,602` (copia a `movbancarios.folioCFDI`), REP valida contra **`cxp_ppd.folio`** (`ppd.service.ts:795-822`, `cfdi.ts:413-451`) → no se afecta, reportes buscan por `ILIKE` (prefijo UUID sigue matcheando), correos muestran el folio tal cual (v1 ya mandaba sufijo). Front → solo muestra; **`idFolioDif` no tiene ningún lector** en API ni web: es columna de escritura. Agente Montse: no hay módulo con ese nombre en `apps/api/src` (solo arrendatarios/notas/soporte); no consume `cxp.folio`.
- `numPagos` queda **desfasado** al rechazar (3 maestros con `numPagos=1` y 0 vivas): `actualizarContador` solo corre en `nuevaParcial`. Llamarlo también al rechazar/devolver.

### H7 · BAJA — §3.1 revalidado hoy: nada cambió
- Hoy 17:00 UTC: `subtotal IS NULL` = **174** (174 con `idCxpPPD`); `diferido AND subtotal=0` = 30 (29 con maestro = 26 heredados + 3 de `editar()`, 1 huérfana `tmKFnNmIt1RBr3d`). Último INSERT `cxp` 2026-10-28; último maestro 2026-10-27. Filas aptas = 177; Σ a escribir = 31,480,112.69 (29,335,505.22 pagadas + 1,234,385.77 aprobadas + 910,221.70 en 1/2/3).
- Triggers de `cxp`: mismos 10 del anexo (`trigger_cxp_validar_fecha_cfdi` sigue `D`; los 9 restantes `O`). Guarda recomendada: añadir `AND c.diferido AND c."idCxpPPD" IS NOT NULL` (hoy redundante, documenta la intención). Orden código→datos→candado, reversa con `DROP NOT NULL` y las 3 a 0: correcto.
- Candado `SET NOT NULL` no detiene el modo de fallo real (0 silencioso: `DEFAULT 0`, `editar()`); un `CHECK (subtotal>0 OR "idCxpPPD" IS NULL)` rompería los 26 heredados al editarlos. El candado verdadero es el código de `editar()`.

### H8 · BAJA — Regla de parciales contra datos reales
- Solo **2** facturas con ≥2 pagos, ambas `mig…` (maestro `total = Σ pagos`, por construcción no hay sobre-solicitud). `migc073dd596c58`: 6,264 + 6,264 = 12,528 = 10,800×1.16; regla → 5,400 + 5,400 ✓. `mig56035e79540a`: 17,228.25 (est. 4, **aprobada desde 24/03/2026 y sin pagar**) + 8,614.125 (pagada 06/05) = 25,842.375; 1.ª con subtotal 19,802.59 (> su total), 2.ª en 0; con la función del plan `S=0` → ambas 0. Ver H3 (TUNECO).
- Supuestos que sí aguantan: `montoAplicado = total` en 100 % de las pagadas (0 distintas), 0 `status=false`, 0 pagadas sin `fecPago`, 0 con `fecAutorizacion` fuera de 2026. Totales con 3 decimales existen (25,842.375 / 8,614.125): `aCentavos` los redondea; el `refine` de 2 decimales aplica al DTO, no al maestro.

### H9 · BAJA — Consecuencias de negocio (cifras HOY, presupuesto de noviembre)
- **Ninguna partida cambia de `dentro_presupuesto`.** Cambian de semáforo (`estado_acumulado`): 53-480-0 Abogados MODERADO→**ALTO** (1,414,126.8 / 1,703,779); 53-340-0, 53-550-0, 53-490-0, 53-450-0, 53-560-0 BAJO→MODERADO; 11-603-1 SIN_GASTOS→BAJO. 52-210-0 ya EXCEDIDO (+452,091 más). 11-601-0 y 11-602-3 sin presupuesto (+123,827 y +18,800).
- Mayores deltas: 11-606-0 Norponiente **+19.29 M**; 11-604-0 Acupark III **+7.87 M** (+7.08 M gastado, +0.78 M aprobado: el reporte original); 11-607-0 Acupark II +0.63 M; 52-210-0 +0.45 M; 52-460-0 +0.37 M.
- Aprobaciones pendientes (61 filas en partidas afectadas + PPD): **ninguna cambia** de resultado en `cxp_autorizar_solicitud_pago`. `oXjvbHRem9oDFiM` (PPD, 11-602-3) ya fallaba; `IfXf7vkKbRWlY8X` (USD 2,900, 53-480-0) pasa como pesos; `GrXZdM4LVCYzKMU` (11-608-0) pasa.
- **Doble conteo: no hay.** La vista suma solo `cxp.subtotal` (6 por `fecAutorizacion`, 4 por `fc`); nada suma `cxp_ppd.subtotal`. Ojo para #77: un apartado que reserve al autorizar **y** una parcial que cuente por `fecAutorizacion` sí duplicarían.
- **Efecto retroactivo:** 146 pagadas con `fecAutorizacion` jun–oct 2026 cambian el «consumido» de meses ya cerrados (Looker `lkr_cxp`, exportes previos). Avisar a quien reporta.
- **10 parciales PPD aprobadas hace >90 días sin pagar**, 9 de v1 con subtotal 0: `GXJ3jZwm9QEFiuM` **$2,320,000** (JAZA, 11-603-0, aprobada 26/05), `Adx800WuyDqfd6e` y `34jYE3e46sRmihA` 27,260 c/u, `OFfVmMRBjxWlpPd` 19,952, `Hu2soqEbYPn8HEi` y `YSmS4WYo867R0AS` 13,740.62 c/u, `KGH1bJv60XgH9su` y `e5MYkpMpJYoVIi6` 5,452 c/u, `HUKywbyzFxxtg7o` 17,228.25 (24/03); más `QDitjFlejOa175k` 191.31 (08/07). Comprometen partida sin base: Jereff decide pagar o cancelar.

## (c) Qué contradice o corrige de la 1.ª ronda y del plan
1. **Plan §1 y anexo datos §3:** los 26 no son «PPD heredados de v1 cuyo maestro tampoco trae subtotal» por un bug de v1: son solicitudes normales `diferido=true` que la **migración del 2026-06-17 (v2)** convirtió en maestros sin leer el XML. El SubTotal **sí es recuperable** (25/25 XML en el bucket). Estimar ÷1.16 se equivoca en 3–4 filas hasta 17.8 %.
2. **Plan §4-A «no probado en vivo»:** la KB ya lo tenía anotado como bug pendiente (`cxp.md:225-230`); no requiere prueba, es consecuencia del índice. Pero la corrección propuesta («consecutivo si repite el día») es incorrecta: debe ser por existencia (H1) y con fecha de México (H2).
3. **Plan §4-B «verificado en código; 2 parciales en Guardado hoy»:** ya ocurrió una vez (H4), con pérdida real de XML/PDF y un maestro huérfano que bloquea la factura.
4. **Anexo código H1:** «las 3 facturas con parcial rechazada siguen con 1 sola fila» — confirmado, y además `numPagos` quedó en 1 con 0 vivas (desfase).
5. **Anexo datos H7:** la simulación de aprobaciones se sostiene hoy (0 cambios); holgura de 53-480-0 = 110,862 antes de `j8D3Dr7uK2X8daJ`. Cifras de §4 del plan deben decir «al 02/11: ninguna partida cruza; 7 cambian de semáforo».
6. **Nada cambió** en conteos ni triggers desde la 1.ª ronda; `fecSolicitud` en UTC es un hallazgo nuevo que afecta más allá del folio.

## (d) SQL / decisión final recomendada
- **Datos (§3.1): aplicar el SQL del anexo de datos §(c) tal cual**, con una línea extra en la guarda y el UPDATE: `AND c.diferido = true AND c."idCxpPPD" IS NOT NULL`. Verificación posterior: `SELECT count(*) FROM cxp WHERE subtotal IS NULL` = 0; `cambios - 'subtotal' <> '{}'` = 0 en las 177 filas `origen=3`; recalcular la vista para 11-604-0 / 11-607-0 / 53-480-0 (esperado: 20,452,354.37 / 2,076,767.63 / 1,592,916.80 comprometido).
- **Folio (A del plan) con dos condiciones antes de construir:** (1) generador por existencia + reintento en 23505; formato del sufijo lo decide Jereff (recomiendo `-ddmmaaaa`); (2) `hoy` en hora de México para `fecSolicitud` y el sufijo (helper compartido). Añadir `actualizarContador` al rechazar/devolver.
- **Heredados (fuera del plan, pero con camino):** script de servidor que lea los 25 XML, parsee `SubTotal`/`Total` y proponga `(idCxpPPD, subtotal)`; aplicar con la misma receta (guardas + respaldo + reversa). Prohibido ÷1.16 sin XML.
- **H4:** disposición de Jereff sobre `EOAbGyyID3KJbAO` (baja del maestro o re-subir archivos) y B del plan **ahora**, incluyendo «no borrar la última parcial sin borrar/avisar del maestro».
- **KB:** corregir `cxp.md:836-838` (trigger activo), anotar en `cxp.md:225-230` que el bug pasa a este plan, documentar la convención del sufijo elegida y el origen real de los 26.
