---
documento: Reporte — Planes con aniversario jun–oct 2026 y estado de su incremento INPC
fecha_corte: 2026-07-02
fuente: BD de producción (solo lectura), validado fila por fila en `arrePdpDetalle`
relacionados: [PLAN-incrementos-inpc-automaticos.md, modulos/arrendatarios.md, OBSOLESCENCIA-BD.md]
palabras_clave: [inpc, incremento, aniversario, renta, arrePdp, pendientes, saneo, arrastre]
---

# Reporte — Incrementos INPC · aniversarios junio–octubre 2026

> **Criterios:** planes **vigentes** (`arrePdp.status=true, vigente=true`) y **activos**
> (`arrenPropiedades.pdpActivo=true`), con aniversario (mes de `fecInicio`) entre junio y octubre y
> `fecFin` posterior al aniversario 2026. **Renta mensual SIN IVA** = suma de `cantidad` de los
> conceptos del plan (excluye depósito y cargos extraordinarios `_EX_`). Desfase de regla: 3 meses
> (INPC de marzo → aniversarios de junio, abril → julio, etc.).
>
> ⚠️ **"INPC corrida" NO es bandera fiable de aplicado** — muchos planes traen INPC *arrastrado* del
> incremento del año pasado (defecto documentado de la RPC manual). El veredicto **¿Aplicado 2026?**
> se determinó por el **salto real del `pm2` por concepto** entre el mes previo y el mes del
> aniversario (junio se validó fila por fila; ver sección de re-validación).

## 🟢 JUNIO — INPC requerido: marzo/26 = **4.59** ✅ capturado

| idArrePdp | Empresa | Parque | Nave | Aniversario | Renta mensual | INPC corrida | Pts | ¿Aplicado 2026? |
|---|---|---|---|---|---:|---:|---:|---|
| `PDP_251229223625_1bb48dd5` | LLLANTAS Y REFACCIONES DE MATAMOROS | Acupark I | 4 | 01/06/2026 | $53,553.68 | 0.00 | 2.50 | 🔴 **PARCIAL/INCONSISTENTE** (ver abajo) |
| `PDP_251224034728_a7977e5b` | ELIZABETH CRESPO HERNANDEZ | Spartek | 17 | 15/06/2026 | $47,394.88 → $50,754.95 | 4.59 | 2.50 | ✅ SÍ (+7.09%) |
| `PDP_260106205901_82b0b4c3` | MAYOREO DE AIRE | Spartek | 31 | 15/06/2026 | $47,650.50 → $51,028.69 | 4.59 | 2.50 | ✅ SÍ (+7.09%) |
| `PDP_251217144045_4d05df48` | MMMR GRP MEXICO | Spartek | 15 | 15/06/2026 | $46,319.46 → $48,445.52 | 4.59 | 0.00 | ✅ SÍ (+4.59%) |
| `PDP_251217152601_468f8718` | MMMR GRP MEXICO | Spartek | 16 | 15/06/2026 | $44,221.87 → $46,251.66 | 4.59 | 0.00 | ✅ SÍ (+4.59%) |
| `PDP_251226165952_b61ac79b` | MOULD TIP | Acupark II | 2 | 15/06/2026 | $24,783.32 → $26,664.38 | 4.59 | 3.00 | ✅ SÍ (+7.59%) |
| `gMgwLj9Gkzegej3` | RHEKRON PLASTICS | Acupark II | 1 | 15/06/2026 | $25,173.29 → $27,083.93 | 4.59 | 3.00 | ✅ SÍ (+7.59%) |
| `PDP_251223162015_f476594a` | TAKAOKAYA MEXICO | Sitapark | B | 16/06/2026 | $71,537.38 (sin cambio) | 0.00 | 2.50 | 🔴 **NO — pendiente completo** |
| `PDP_251223193723_fe5d69ad` | GPRINT | Actitek | 15 | 22/06/2026 | $70,044.67 → $56,981.17¹ | 5.57 *(arrastre)* | 2.00 | 🔴 **NO en conceptos base — pendiente** |

¹ *La baja de GPRINT es **legítima**: los conceptos financiados "Mtto FINSA" ($1,300.00) y "Otros
servicios inmobiliarios" ($11,763.50) **terminaron de cobrarse en la partida 48**; la 49 ya no los
incluye (70,044.67 − 13,063.50 = 56,981.17 ✓ exacto). Confirmado por el usuario y por datos.*

### Re-validación de junio (fila por fila, por concepto) — 2026-07-02

**✅ Correctos (6):** ELIZABETH, MAYOREO, MMMR×2, MOULD TIP, RHEKRON — todos los conceptos del plan
subieron con el factor exacto `×(1+(4.59+pts)/100)` y el INPC quedó escrito solo en el año correcto.

**🔴 Pendientes de saneo/aplicación manual (3)** — los tres son ya **tardíos** (aniversario pasado)
→ por regla acordada, decisión manual del usuario:

| Plan | Diagnóstico | Renta hoy | Quedaría en (estimado) |
|---|---|---:|---:|
| **TAKAOKAYA B** `PDP_251223162015_f476594a` | Sin NINGÚN incremento: partida 13 (16/jun) idéntica al año 1 (`INPC=0`, mismo `pm2` en los 5 conceptos, incl. "Mtto BQ") | $71,537.38 | ≈$76,609 (+7.09%) |
| **LLLANTAS** `PDP_251229223625_1bb48dd5` | **Aplicación parcial inconsistente**: desde la partida 13, Administración y Vigilancia subieron **solo +2.5%** (los pts, con INPC=0: 3.6580→3.7495) pero **Renta y Mantenimiento quedaron sin tocar** (101.735 igual). Edición manual que solo alcanzó 2 de 4 conceptos | $53,553.68 | ≈$57,351 (+7.09% sobre base año 1, corrigiendo el 2.5% parcial) |
| **GPRINT** `PDP_251223193723_fe5d69ad` | Financiados terminados OK (nota ¹), pero los conceptos que **continúan** (Renta 84.4203, Admin/Mtto/Vig 3.4529) tienen el mismo `pm2` en el año 5 que en el 4: **incremento 2026 no aplicado**. El 5.57 escrito es arrastre viejo | $56,981.17 | ≈$60,736 (+6.59% = 4.59+2) |

## 🟡 JULIO — INPC requerido: abril/26 = **4.46** ✅ capturado → aplicables, NINGUNO aplicado

| idArrePdp | Empresa | Parque | Nave | Aniversario | Renta mensual | INPC corrida | Pts | ¿Aplicado 2026? |
|---|---|---|---|---|---:|---:|---:|---|
| `PDP_251226163258_9c7bf59b` | FARMER PARTS | Acupark II | 31 | 01/07/2026 | $49,706.91 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226164456_7623e6c3` | FARMER PARTS | Acupark II | 32 | 01/07/2026 | $49,707.90 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226194504_23723637` | FARMER PARTS | Acupark II | 40 | 01/07/2026 | $49,588.11 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226213837_5d3633c3` | FARMER PARTS | Acupark II | 53 | 01/07/2026 | $49,572.27 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226214115_ad6db9b6` | FARMER PARTS | Acupark II | 54 | 01/07/2026 | $49,573.26 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226214307_e7614577` | FARMER PARTS | Acupark II | 55 | 01/07/2026 | $49,567.32 | 0.00 | 2.50 | ❌ NO |
| `PDP_251226215430_69502401` | FARMER PARTS | Acupark II | 56 | 01/07/2026 | $60,907.25 | 0.00 | 2.50 | ❌ NO |
| `PDP_251222221031_f9cfa8fd` | IMPORTADORA SERRANA | Spartek II | 79 | 01/07/2026 | $59,266.27 | 3.80 *(arrastre)* | 1.00 | ❌ NO |
| `ZXMnvC2qXW6di7G` ⚠️² | IMPORTADORA SERRANA | Spartek II | 79 | 01/07/2026 | $39,058.14 | 4.21 *(arrastre)* | 1.00 | ❌ NO |
| `PDP_251222221522_0a8cd428` | IMPORTADORA SERRANA | Spartek II | 80 | 01/07/2026 | $41,847.16 | 3.80 *(arrastre)* | 1.00 | ❌ NO |
| `5PsBwpejcIoIv93` ⚠️² | IMPORTADORA SERRANA | Spartek II | 80 | 01/07/2026 | $39,059.89 | 4.21 *(arrastre)* | 1.00 | ❌ NO |
| `PDP_251222221710_5d3f9366` | IMPORTADORA SERRANA | Spartek II | 81 | 01/07/2026 | $40,932.71 | 3.80 *(arrastre)* | 1.00 | ❌ NO |
| `PDP_251228071705_8f139b1d` | KIRCHOFF AUTOMOTIVE | Acupark II | 33 | 28/07/2026 | $2,889.58 | 0.00 | 3.00 | ❌ NO |

² *⚠️ **Duplicados a revisar**: las naves 79 y 80 de SERRANA tienen **dos planes vigentes+activos
cada una** — uno con id formato v2 (`PDP_…`) y otro con id formato v1 (`ZXMnvC2qXW6di7G`,
`5PsBwpejcIoIv93`). Sospecha: el plan viejo de v1 quedó activo al crear el nuevo. Revisar y sanear
ANTES de que el flujo automático les aplique doble incremento.*

## 🟡 AGOSTO — INPC requerido: mayo/26 = **3.94** ✅ capturado → aplicables, NINGUNO aplicado

| idArrePdp | Empresa | Parque | Nave | Aniversario | Renta mensual | INPC corrida | Pts | ¿Aplicado 2026? |
|---|---|---|---|---|---:|---:|---:|---|
| `PDP_251227015213_2d42bc28` | SPRAY CONTROL QUERETARO | Acupark II | 8 | 01/08/2026 | $25,837.78 | 3.93 *(arrastre)* | 3.00 | ❌ NO |
| `PDP_251217140438_be6887a1` | GRUPO ETI KAAB | Spartek | 48 | 14/08/2026 | $92,902.88 | 0.00 | 3.00 | ❌ NO |
| `PDP_260119164717_665afb10` | WIKUS SIERRAS CINTAS | Acupark II | 26 | 15/08/2026 | $75,510.18 | 3.93 *(arrastre)* | 1.00 | ❌ NO |
| `PDP_260119202235_639813ee` | WIKUS SIERRAS CINTAS | Acupark II | 27 | 15/08/2026 | $46,203.67 | 3.93 *(arrastre)* | 1.00 | ❌ NO |

## ⏳ SEPTIEMBRE — requiere INPC de junio/26 (INEGI lo publica ~10 de julio; aún NO capturado)

| idArrePdp | Empresa | Parque | Nave | Aniversario | Renta mensual | INPC corrida | Pts | Estado |
|---|---|---|---|---|---:|---:|---:|---|
| `PDP_251218171117_ad41c781` | INTERSURGICAL LIMITED | Spartek | 41 | 01/09/2026 | $48,681.88 | 0.00 | 2.50 | ⏳ Espera INPC jun |
| `PDP_251218164923_e6d10e48` | INTERSURGICAL LIMITED | Spartek | 42 | 01/09/2026 | $47,426.11 | 0.00 | 2.50 | ⏳ Espera INPC jun |
| `PDP_251229233554_2d6efab6` | PLANTAS MEDICINALES ANAHUAC | Spartek | 25 | 01/09/2026 | $47,303.48 | 4.42 *(arrastre)* | 3.00 | ⏳ Espera INPC jun |
| `PDP_251230001244_ca53e831` | THRONOS SEATING SOLUTIONS | Spartek | 30 | 01/09/2026 | $59,421.69 | 4.42 *(arrastre)* | 2.00 | ⏳ Espera INPC jun |
| `PDP_260123181250_f413cf69` | PURATOS DE MEXICO | Actitek | 17 | 01/09/2026 | $66,907.84 | 0.00 | 2.50 | ⏳ Espera INPC jun |
| `PDP_251229224240_cc19c40c` | MEMORAMA EMPRESARIAL | Acupark I | 16 | 13/09/2026 | $27,601.14 | 0.00 | 3.00 | ⏳ Espera INPC jun |

## ⏳ OCTUBRE — requiere INPC de julio/26 (~10 de agosto; aún NO capturado)

| idArrePdp | Empresa | Parque | Nave | Aniversario | Renta mensual | INPC corrida | Pts | Estado |
|---|---|---|---|---|---:|---:|---:|---|
| `PDP_251228043634_1f8a6f4e` | AGROSOLUCIONES ACUEDUCTO | Acupark II | 18 | 01/10/2026 | $48,847.96 | 4.32 *(arrastre)* | 1.50 | ⏳ Espera INPC jul |
| `PDP_260123210914_b23df8e4` | DEUMEX TRADING | Actitek | 18 | 01/10/2026 | $64,791.64 | 0.00 | 2.50 | ⏳ Espera INPC jul |
| `PDP_260313160200_d644ff07` | TAKAOKAYA MEXICO | Sitapark | D | 01/10/2026 | $67,142.77 | 4.32 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |
| `BXPeEbEGiQ4ujQR` | TAKAOKAYA MEXICO | Sitapark | G | 01/10/2026 | $63,807.61 | 4.32 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |
| `PDP_260313180822_bb42807c` | TAKAOKAYA MEXICO | Sitapark | H | 01/10/2026 | $63,808.30 | 0.00 | 2.00 | ⏳ Espera INPC jul |
| `PDP_251223170401_7b8861b3` | TAKAOKAYA MEXICO | Sitapark | I | 01/10/2026 | $63,223.76 | 4.32 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |
| `PDP_251229205948_be7ae30e` | PLASMATEREAT MEXICO | Acupark II | 6 | 15/10/2026 | $47,903.66 | 4.32 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |
| `UgCCuYZeaHpIwKs` | SUSPENSYS AUTOMOTIVE | Spartek | 59 | 25/10/2026 | $54,647.88 | 4.21 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |
| `LHvYQZkxn51XVey` | SUSPENSYS AUTOMOTIVE | Spartek | 60 | 25/10/2026 | $54,878.66 | 4.21 *(arrastre)* | 2.00 | ⏳ Espera INPC jul |

## Resumen ejecutivo (corte 2026-07-02)

| Mes | Planes | Estado |
|---|---:|---|
| Junio | 9 | ✅ 6 aplicados correctos · 🔴 **3 pendientes de saneo manual** (TAKAOKAYA B, LLLANTAS parcial, GPRINT) |
| Julio | 14² | 🟡 **0 aplicados** — INPC abril (4.46) capturado → aplicables YA (tardíos por días) |
| Agosto | 4 | 🟡 **0 aplicados** — INPC mayo (3.94) capturado → aplicables YA |
| Septiembre | 6 | ⏳ Esperan captura del INPC de junio (~10/jul) |
| Octubre | 9 | ⏳ Esperan captura del INPC de julio (~10/ago) |

² *Incluye los 2 posibles duplicados de SERRANA (naves 79/80) — sanear antes de aplicar.*

**Lecciones incorporadas al diseño** (ver `PLAN-incrementos-inpc-automaticos.md`):
la vista previa del flujo automático valida **por concepto** (no por agregado del plan) para atrapar
aplicaciones parciales tipo LLLANTAS; la bandera de "ya aplicado" vive en `arre_incrementos`, nunca
en el INPC de la corrida (arrastres).
