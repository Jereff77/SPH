---
modulo: Incrementos de renta por INPC (Arrendatarios)
claves_permiso: [212 (capturar INPC + aplicar/revertir/reaplicar + Responsables), 20 (leer bitácora por plan)]
entidades: [arre_incrementos, parque_responsables, arrePdpDetalle.aplicaInpc, SPHConfiguraciones (ARRE_INPC_DESFASE_MESES, ARRE_INPC_GERENTE_UID), inpc]
palabras_clave: [incremento, INPC, renta, aniversario, aplicar incremento, revertir incremento, re-aplicar,
  desfase, responsable de parque, gerente, correo de incrementos, bitácora de incrementos, reserva incompleta,
  no se aplicó el incremento, incremento pendiente, captura tardía, aplicaInpc, snapshot]
relacionados: [arrendatarios, configuraciones (Parámetros→INPC), parques]
estado: ✅
---

# Incrementos de renta por INPC

## Qué hace / para qué sirve
Cada año la renta de los arrendatarios sube **INPC + puntos pactados** en el aniversario del contrato.
Este módulo lo automatiza: al **capturar el INPC del mes** (Configuraciones → Parámetros → INPC, permiso
212) el sistema calcula qué planes vigentes+activos cumplen aniversario en el mes `INPC + desfase`
(config `ARRE_INPC_DESFASE_MESES`, default 3: INPC de junio → aniversarios de septiembre), muestra una
**vista previa** (renta actual → renta nueva por plan y por concepto) y, **solo con confirmación**,
aplica el incremento, lo registra en la bitácora reversible y **notifica por correo** a los responsables
de parque y a la gerente.

## Cómo se usa (flujo del usuario)
1. **Capturar/editar el INPC** en Parámetros → INPC → se abre la vista previa automáticamente. También:
   botón **Incrementos** en cada registro, y **banner ámbar** si el INPC más reciente tiene pendientes.
2. **Vista previa**: ✅ aplicables (con checkbox y desglose por concepto), ⚠️ manuales (el automático NO
   los toca: pagos en el año, aniversario pasado, montos ya modificados sin bitácora, plan inactivo),
   omitidos (ya aplicados; si el valor difiere del vigente ofrece **"Revertir y re-aplicar"**).
3. **Aplicar incrementos** → informe (aplicados/fallidos + correos enviados).
4. **Bitácora**: en Planes de Renta (franja verde sobre la corrida → Historial) y en la vista previa
   (▸ Historial de esta captura). Acciones: **Revertir** (con motivo), **Re-aplicar** (si el INPC vigente
   difiere), **Reenviar correo**.
5. **Arrendatarios → Responsables** (permiso 212): asignar gerente + N responsables por parque (solo
   usuarios activos con correo). Cada responsable recibe SUS parques; la gerente recibe TODO y cubre los
   parques sin responsable.

## Arquitectura
- **BD**: `arrePdpDetalle.aplicaInpc` (false = cargo extraordinario exento); tabla `arre_incrementos`
  (bitácora: snapshot por concepto×año en `detalle.previo` → reversión exacta; índice único parcial
  `(idArrePdp, anioAplicado) WHERE estado='aplicado'` → anti doble aplicación); tabla
  `parque_responsables`; RPCs **`arrepdp_aplicar_incremento_inpc`** y **`arrepdp_revertir_incremento_inpc`**
  (atómicas, solo service_role — REVOKE a anon/authenticated). Migraciones:
  `migraciones/2026-07-02-incrementos-inpc-f0.sql` y `-f1-rpc.sql`.
- **Backend** (`apps/api/src/modules/arrendatarios/`): `incrementos.service.ts` (preview/aplicar/
  revertir/reaplicar/bitacora/registrarManual), `incrementos.controller.ts`
  (`/arrendatarios/incrementos/*`), `responsables.service.ts`+`controller`, `incrementos-notificador.service.ts`
  (correo vía `InvitacionesMailer.enviarHtml`, patrón recordatorio CxP; best-effort con trazado
  `correoNotificado`/`fecNotificacion` y reenvío).
- **Frontend**: `IncrementosPreviewModal.tsx`, `IncrementosBitacora.tsx` (+Modal), `ResponsablesPage.tsx`,
  `incrementos.api.ts`; disparo y banner en `parametros/InpcTab.tsx`; franja en `ArrendatariosPage.tsx`.

## Reglas de negocio
- Fórmula: `pm2[añoN] = pm2[añoN−1] × (1+(INPC+ptsINPC)/100)` **por concepto**; año 1 = base intocable.
- **Nunca se proyectan INPC desconocidos**: años futuros quedan planos (pm2 nuevo, INPC=0 — de paso se
  limpian los "arrastres" heredados de las funciones viejas). Incrementos compuestos al llegar cada INPC.
- La RPC opera por **rango de numPartida** (`(N−1)·12+1…N·12`) → inmune al gotcha del `anio` desalineado.
- Respeta **meses de gracia** (pm2=0 no se toca) y **conceptos sin base** en el año anterior (financiados
  nuevos/terminados → se omiten y reportan).
- **Dinero cobrado manda**: si el año objetivo tiene pagos, ni aplicar ni revertir proceden (decisión
  manual). Captura tardía con **corte a MES COMPLETO** (decisión Jereff 2026-07-02): un aniversario del
  mes en curso aplica aunque el día ya haya pasado (contratos que inician los días 1–9 + INPC capturado
  ~día 10); solo va a manual si el MES del aniversario ya quedó atrás — EXCEPTO en re-aplicación por
  corrección confirmada (ahí sí procede: la reversión ya garantizó que no hay pagos).
- La **edición manual** del INPC (doble clic en la corrida) sigue viva y registra `origen='manual'` en la
  bitácora (sin snapshot → no reversible automáticamente).
- Correo **best-effort**: si el SMTP falla, los incrementos NO se revierten; se reenvía después.

## Gotchas / trampas conocidas
- **"Reserva incompleta"**: si el proceso muere entre la reserva del candado y la RPC, queda una fila
  `aplicado` con `detalle.estado='en_proceso'`. La vista previa lo señala y **"Revertir" la libera** sin
  tocar la corrida.
- El **INPC de la corrida NO es bandera de aplicado** (arrastres históricos): la fuente de verdad es
  `arre_incrementos`. El badge ⚠️ "aplicado con valor distinto al vigente" se calcula al vuelo.
- La RPC de aplicar es **idempotente** (siempre parte del año N−1): re-ejecutarla da el mismo resultado;
  el candado real anti-doble vive en `arre_incrementos` (capa servicio).
- 📌 Invariante del snapshot: se guarda `max(pm2)` por concepto×año — hoy todas las filas de un
  concepto×año comparten pm2 (verificado); si algún día hubiera pm2 escalonado dentro de un año, la
  reversión aplanaría al máximo.
- 📌 El permiso **212 habilita capturar INPC Y aplicar/revertir el dinero** (decisión de Jereff
  2026-07-02); si se quisiera separar, haría falta una clave nueva.
- Preview vs RPC: el preview incluye partida 0 en "año previo" al buscar base y la RPC no; inofensivo
  porque el Depósito en Garantía no comparte concepto con filas incrementables.
- `InpcTab` (feature parametros) importa componentes de `features/arrendatarios` — acoplamiento
  intencional (el disparo vive en la captura).
- **NO existe ningún cron de INPC**: antes de este módulo TODO incremento era manual (doble clic).

## Decisiones y pendientes
- Diseño y decisiones con fechas: `PLAN-incrementos-inpc-automaticos.md` §8.
- Validación adversarial (Opus 4.8, 2026-07-02): A1 (fuga SQLERRM), M1 (reserva huérfana), M2 (corrección
  tardía sin re-aplicar) **corregidos**; RLS/REVOKEs/auditoría/candado verificados contra BD real.
- Prueba e2e con datos sintéticos (2026-07-02): aplicación exacta (100→106.46, $45,000→$47,907, IVA
  trigger OK), gracia respetada, extraordinario exento, TIENE_PAGOS bloquea aplicar y revertir,
  reversión exacta, candado único probado; **limpieza total (0 residuos)**.
- **Estreno en producción (2026-07-02, v2.52.0):** el usuario aplicó los **17 incrementos** de julio
  (INPC abril 4.46) y agosto (INPC mayo 3.94) desde la vista previa; validación posterior al centavo:
  **17/17 con matemática exacta**, futuros planos, cero pagos tocados; correos enviados (1 destinatario
  la 1ª tanda, 4 la 2ª — reenviables). Primera **reversión real** OK (SERRANA 79 viejo, restauración exacta).
- ⚠️ Operativos pendientes: **duplicados SERRANA naves 79/80** (dos planes vigentes por nave, mismo
  `idNavArrend`, fechas idénticas 2023→2033, CERO pagos; los `PDP_251222*` se recrearon el 22/dic/2025 y
  los v1 quedaron activos) — **el responsable del área los está revisando (acordado con Jereff
  2026-07-02)**; al confirmar: revertir el incremento pendiente del viejo de la 80 (`5PsBwpejcIoIv93`,
  sigue 'aplicado') y eliminar los 2 planes v1 con el flujo estándar. Mismo patrón sospechoso en
  **CHANGER & DRESSER nave 87** (sin diagnosticar). Sanear los 3 casos de junio del
  `REPORTE-incrementos-inpc-2026-jun-oct.md` (TAKAOKAYA B, GPRINT, LLLANTAS — manuales). DROP de las 6
  funciones obsoletas (OBSOLESCENCIA-BD.md §7) con autorización caso por caso.
