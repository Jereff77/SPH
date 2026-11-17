# Validación adversarial «Gate-Código» — PLAN-subtotal-ppd (§1, §2.2, §4, §5)

Fecha: 2026-11-02 · Validador: Opus · BD consultada solo con SELECT · Scripts: `temp/validacion-subtotal-ppd/` (`sim.mjs`, `salida.json`, `ppd-subtotal.ts`, `prueba.test.mjs`).

## (a) VEREDICTO: **APTO CON CONDICIONES** (no se construye como está escrito)

La fórmula es correcta en lo esencial: con pagos del 100 % (los 174 casos de hoy) copia exacto el subtotal y nunca queda negativa. **Pero** el plan dice que «funciona con cualquier monto y orden», y en producción eso es falso hoy (H1). Además deja abiertas tres vías de escritura que rompen la suma (H2–H4). Los dos hallazgos ALTA ya existían antes del plan y este cambio no los empeora, pero tienen que llegar a Jereff y quedar dispuestos antes de dar por buenas las parcialidades. Condiciones mínimas para construir: **C1** H3 + H4 (vías de escritura), **C2** H5 + H6 (función en centavos y acumulada), **C3** H7 (montos con 2 decimales), **C4** sacar el subtotal ya asignado de la misma lectura que el saldo (H8). H2 se corrige en el mismo cambio, porque se toca el mismo `editable()`/`eliminar()`.

## (b) Hallazgos

**H1 · ALTA (ya existía; invalida la premisa del plan) — Hoy la 2.ª parcialidad de cualquier factura PPD de v2 truena.**
Evidencia: `cxp_folio_key = CREATE UNIQUE INDEX ... ON public.cxp (folio)` (sin filtro). `insertarParcial` inserta `folio: ctx.folio` (UUID de la factura, `ppd.service.ts:518`), y en BD **178/178** parciales v2 tienen `folio = cxp_ppd.folio`. Ningún trigger reescribe el folio. v1 usaba sufijo (`<UUID>-2252026`, filas `mig…`). `solicitudes.service.ts:485` incluso comenta «el folio se repite por parcialidad», cosa que la BD prohíbe. Consecuencias: (i) `nuevaParcial` → violación de unicidad → 500 «No se pudo crear la solicitud parcial»; (ii) una parcial **rechazada** conserva el folio y su reemplazo también truena. Las 3 facturas con parcial rechazada siguen con 1 sola fila. Por eso «las 174 pagan el 100 %» no es una casualidad: v2 no puede hacer abonos.
Corrección: es decisión de Jereff/Toribio porque cambia el contrato del folio. Opciones: sufijo estilo v1 en `cxp.folio` (el UUID real ya vive en `idFolioDif`) o índice único parcial. Mientras no se corrija, la lógica de proporción y cierre es código que no se ejecuta en producción, y el plan no debe prometerla.

**H2 · ALTA (ya existía; pérdida de datos) — Eliminar una parcial PPD en «Guardado» borra el XML/PDF de la factura maestra.**
Evidencia: `solicitudes.service.ts:290-304` `eliminar()` hace `storage.remove` de `urlCFDI`/`urlXLM` de la fila, y **178/178** parciales v2 comparten esas URL con `cxp_ppd`. **2 parciales PPD están hoy en idEstado 1** (`GrXZdM4LVCYzKMU`, `IfXf7vkKbRWlY8X`), con 🗑 habilitado (`SolicitudesPage.tsx:361-377`). Tampoco recalcula `numPagos`.
Corrección: en `eliminar()`, si `idCxpPPD` no es nulo, no borrar archivos y llamar a `actualizarContador`. Lo mismo ya se toca en `editable()` (H3).

**H3 · MEDIA — `editar()` escribe el `subtotal`/`total` que manda el cliente en filas PPD.**
Evidencia: `solicitudes.service.ts:664-690` hace update de `subtotal: dto.subtotal, total: dto.total, folio, idProveedor, moneda`. Se llega por dos vías: `aprobacion.service.ts:215-227` (Regresar 2→1) y `pendientes.service.ts:236-259` (Devolver 2–4→1). El ✎ está habilitado para `tipoOperacion < 4` (`SolicitudesPage.tsx:362`), y las parciales PPD son `tipoOperacion 1`. Hoy además permite subir el `total` por encima del disponible (se brinca el control de saldo) y cambiar el folio.
Corrección: `editable()` agrega `idCxpPPD` al select. En `editar()`, si es PPD, **solo** se actualizan `idCategoria` y `concepto`, y cualquier diferencia en total/subtotal/folio/proveedor/moneda/fecCFDI responde 400 («para cambiar el monto, elimine la parcialidad y solicite otro pago»). El front deshabilita esos campos cuando `diferido`.

**H4 · MEDIA — «Devolver» desde Rechazada (3→1) revive la parcial sin revalidar el saldo.**
Evidencia: `pendientes.service.ts:245` acepta `e > 1 && e <= 4`. Una parcial rechazada cuyo monto ya se volvió a pedir regresa a contar. En la simulación con esta acción, el **1.6 %** de las facturas termina sobre-solicitado y en las liquidadas la suma de subtotales se infla (ejemplo: 21,966,208.10 contra 17,368,481.66 con la función final).
Corrección: para filas con `idCxpPPD` e `idEstado = 3`, bloquear (400) o revalidar `disponible(sin ella) ≥ total − 0.01` y **recalcular** su subtotal con la función, usando `subtotalAsignado` sin ella. Recomiendo bloquear, que es más simple: si se quiere volver a pagar, se crea otra parcial.

**H5 · BAJA (corrección obligatoria por lo barata) — `cierra` compara en double.**
Evidencia: `36629305.95 − 0.01 = 36629305.940000005`, así que `monto = disponible − 0.01` **no** cierra en el **14.8 %** de 135,136 pares probados (ejemplo: disponible 2.24, monto 2.23 → el plan da 1.92 en vez de 1.93). En la simulación secuencial hubo 586 facturas «liquidadas» con desfase con la función del plan, contra 70 con la versión en centavos. El efecto es de centavos, pero la prueba §5.3 del plan no lo detecta.
Corrección: comparar en centavos enteros (versión final abajo).

**H6 · BAJA — El redondeo por parcial se acumula y el `Math.max(0, …)` lo esconde.**
Evidencia: con 99,999 pagos de 0.01 (T=1000, S=862.07), cada pago redondea 0.0086 a 0.01; la suma llega a **999.98 contra 862.07** y el cierre se recorta a 0. En la simulación secuencial, 48 cierres «negativos» quedaron enmascarados.
Corrección: objetivo **acumulado**, `round(S·solicitadoTras/T) − asignado`. El error queda acotado a 1 centavo por factura (la prueba pasa: 862.07).

**H7 · BAJA — El DTO acepta montos de menos de un centavo.**
Evidencia: `ppd.schemas.ts:15-17` solo pide `.positive()`. En la BD ya hay totales con 3 decimales (`mig…`: 8614.125). Un pago de 0.005 da subtotal 0 y deja saldo con «polvo».
Corrección: `.refine(m => Math.abs(m*100 - Math.round(m*100)) < 1e-6, 'Máximo 2 decimales')` en el `monto` de ambos esquemas.

**H8 · MEDIA (latente; hoy lo tapa H1) — Concurrencia.**
`saldoDe` se lee sin bloqueo. Al corregir H1, dos solicitudes simultáneas pueden pasar **las dos** como «cierre» (las dos reciben S − Y) o rebasar el total. Con concurrencia forzada en la simulación, el 24 % de las facturas quedó sobre-solicitado y el 39 % de las liquidadas con suma inexacta (las tres variantes por igual: no es un problema de la fórmula). Hoy, un segundo insert en la misma factura revienta contra `cxp_folio_key`, así que todavía no se puede dar.
Evaluación: el riesgo real es bajo (un dueño por factura y el botón se deshabilita mientras está pendiente, `NuevaParcialPpd.tsx:60`), pero el costo sería dinero.
Mecanismo mínimo, sin migración: (1) leer `subtotalAsignado` **en la misma consulta** que el saldo (C4, ya se pide); (2) **verificación después del insert** en `nuevaParcial`: volver a leer `saldoDe`; si `disponible < −0.01`, borrar la fila propia y responder 409 «otra solicitud cambió el saldo, reintente». Lo robusto es una función SQL con `SELECT … FROM cxp_ppd … FOR UPDATE` que calcule e inserte; no lo exijo para este cambio. La verificación después del insert es obligatoria **en el mismo cambio que corrija H1**.

**H9 · BAJA (impacto que Jereff debe conocer) — Divisa.**
Hay 2 parciales no-MXN: `IfXf7vkKbRWlY8X` en **USD** (subtotal 2,900, idEstado 1, **partida 53-480-0**, justo la que el plan dice que pasa a «fuera de presupuesto») y `JC3FjLXdjjw75Xy` con moneda **«XXX»** (38,280, pagada). Al llenar el subtotal, si se aprueban, cuentan como pesos sin convertir. Hoy no hay precedente: las solicitudes EUR normales tienen subtotal 0.
Corrección: ninguna en código para este cambio, pero el plan §3 debe decir que estos importes **pasan de invisibles a mal sumados**.

**H10 · BAJA — Consumidores: ninguno trata NULL como señal de PPD.**
Grep en `apps/api` y `apps/web`: no hay `subtotal == null`/`!subtotal` con significado; todo es `?? 0` (`aprobacion.service.ts:176,265`, `pagos.service.ts:188`, `reportes-export.ts:29`, `EditarSolicitudModal.tsx:30`). En SQL, solo `cxp_autorizar_solicitud_pago` (NULL→0) y `cxp_get_estado_cuenta_detalle_v2` (lo proyecta tal cual). Ninguna vista usa `IS NULL` ni `diferido`/`idCxpPPD` sobre subtotal. `v_resumenpresupuesto` y `"v_resumenPresupuesto"` son **dos vistas idénticas** (mismo md5): la RPC usa la minúscula, porque la cita sin comillas, y el API la de camelCase. Si algún día se cambia una, hay que cambiar las dos.
Cambios que verá la gente: subtotal y «fuera de presupuesto» en el modal de Aprobar; la RPC **podrá rechazar** aprobaciones PPD (habrá que reasignarlas a quien aprueba fuera de presupuesto); totales de Pagar; columna Subtotal de Reportes; «Consumido» en Configuraciones→Cuentas (`parametros.service.ts:115`).

**H11 · BAJA (ya existía; aparte) — Una parcial PPD regresada a Guardado no se puede volver a enviar.**
`enviar()` exige `fecCFDI` del mes en curso (`solicitudes.service.ts:326`). Las 2 filas que hoy están en idEstado 1 (fecCFDI 2026-06-15 y 2026-09-23) están atoradas.

**H12 · BAJA — Pruebas.**
`apps/api/package.json` declara `"test": "jest"`, pero jest no está instalado (ni dependencia, ni configuración, ni binario; consta en `.sessions/bitacora.md:6734`). La función pura sí se puede probar hoy con `node --test` (Node 22.21 quita los tipos de `.ts` sin flags): **9/9 pasan** en `temp/validacion-subtotal-ppd/prueba.test.mjs`.

**Seguridad (pregunta 7): sin hallazgos nuevos.** El `monto` viene del cliente, pero el servidor lo valida contra el saldo. Total y subtotal del maestro se leen en el servidor (`supabase.admin`). El cálculo debe vivir en el API (sí) y la escritura seguir con `comoActor(actorUid)`, con el actor del JWT. Riesgo que ya existía y no cambia: el subtotal del alta sale de un XML que sube el usuario, sin comparar `cfdi.total` contra `totalEsperado` (lo mismo pasa en las solicitudes normales).

## (c) Versión FINAL recomendada

**Archivo nuevo** `apps/api/src/modules/cxp/ppd-subtotal.ts` (función pura, probada):

```ts
const aCentavos = (n: number): number => Math.round(n * 100);
export function subtotalParcial(
  factura: { subtotal: number | null; total: number | null },
  monto: number,
  saldo: { disponible: number; subtotalAsignado: number },
): number {
  const T = aCentavos(factura.total ?? 0);
  const S = aCentavos(factura.subtotal ?? 0);
  if (!(T > 0) || !(S > 0)) return 0;
  const M = aCentavos(monto), D = aCentavos(saldo.disponible), Y = aCentavos(saldo.subtotalAsignado);
  const cierra = M >= D - 1;
  const objetivo = cierra ? S : Math.round((S * Math.min(T, T - D + M)) / T);
  return Math.max(0, objetivo - Y) / 100;
}
```

**Puntos de integración**

1. `ppd.service.ts:95-122` `saldoDe`: el maestro selecciona `total, subtotal` y las parciales `total, subtotal, montoAplicado, idEstado`. Devuelve además `subtotalFactura` y `subtotalAsignado` (Σ subtotal de las no rechazadas) **de la misma lectura**. `SaldoPpd` (líneas 33-38) suma esos dos campos; agregar campos no rompe el front.
2. `ppd.service.ts:502` agrega `subtotal: number` a `p`, y la **línea 523** queda `subtotal: p.subtotal`.
3. `ppd.service.ts:660-681` `crearConFactura`: `subtotal: subtotalParcial({ subtotal: cfdi.subtotal, total: cfdi.total }, dto.monto, { disponible: cfdi.total, subtotalAsignado: 0 })`.
4. `ppd.service.ts:719-754` `nuevaParcial`: con `saldo = await this.saldoDe(id)`, `subtotal: subtotalParcial({ subtotal: saldo.subtotalFactura, total: saldo.total }, dto.monto, saldo)`. Después del insert y de `actualizarContador`, la verificación de H8 en cuanto se corrija H1.
5. `ppd.schemas.ts:15-17`: refine de 2 decimales (H7).
6. `solicitudes.service.ts:258-273` `editable()` selecciona `idCxpPPD`. En `:664-690` `editar()`, para PPD solo `idCategoria`/`concepto` (H3). En `:290-313` `eliminar()`, para PPD no borrar archivos y recontar (H2). En el front, `EditarSolicitudModal.tsx` deshabilita montos/folio si `diferido`.
7. `pendientes.service.ts:236-259` `devolver()`: bloquear 3→1 cuando `idCxpPPD` (H4).
8. Pruebas: `apps/api/src/modules/cxp/ppd-subtotal.spec.ts` con el estilo del repo (`describe/it/expect`, como `rep-fechas`/`exigir-permiso.spec.ts`) y los 9 casos de `prueba.test.mjs` (el de 99,999 pagos se baja a 5,000 por tiempo). Mientras jest no esté instalado, se corren con `node --test` en la verificación §5.
9. Después del candado (§2.3): regenerar `packages/types/src/database.types.ts` (cxp Row/Insert/Update `subtotal: number | null`, líneas 2929/2986/3043), para que un `subtotal: null` falle al compilar.
