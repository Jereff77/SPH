---
name: sph-knowledge
description: |
  Conocimiento arquitectónico del sistema ERP SPH Bienes Raíces.
  Activa este skill cuando necesites contexto sobre la estructura de la base de datos,
  convenciones del negocio, evoluciones arquitectónicas o flujos de trabajo del sistema SPH.

  Triggers:
  - "contexto SPH", "arquitectura SPH", "cómo funciona SPH"
  - "explícame el sistema", "cómo están relacionadas las tablas"
  - "qué significa pdpActivo", "dónde se guardan los pagos"
  - "qué es un PDP", "qué es arrePdp", "qué es arrenPropiedades"
  - Cualquier pregunta sobre convenciones de nomenclatura del sistema
license: MIT
---

# SPH Bienes Raíces — Conocimiento del Sistema ERP

Este skill contiene el conocimiento arquitectónico y de negocio del sistema ERP SPH Bienes Raíces
(base de datos Supabase/PostgreSQL, proyecto supaSPH).

**IMPORTANTE**: Esta es una base de datos en producción con información real. No realizar cambios sin autorización explícita del usuario.

---

## 1. Modelo de Negocio

SPH Bienes Raíces administra parques industriales compuestos de **naves** (bodegas/locales). El negocio tiene dos flujos principales:

1. **Venta de naves**: Se crea un plan de pagos (PDP) a plazos para que un inversionista adquiera la nave.
2. **Arrendamiento de naves**: Naves ya vendidas o propias de SPH se rentan a arrendatarios mediante contratos (arrePdp).

---

## 2. Tablas Principales y su Propósito

### Estructura jerárquica core
```
parques → naves → propiedades → pdp → pdpDetalle → pagos
                              ↘ arrenPropiedades → arrePdp → arrePdpDetalle
```

| Tabla | Propósito |
|-------|-----------|
| `parques` | Catálogo de parques industriales (Spartek, Actitek, Omega, etc.) |
| `naves` | Cada nave/local dentro de un parque. Campo clave: `numNaveNAME` |
| `propiedades` | Relación entre una nave y su dueño actual (inversionista). Una nave puede tener múltiples propiedades a lo largo del tiempo |
| `inversionista` | Catálogo de personas o empresas que compran naves |
| `pdp` | Plan de Pagos de una propiedad. Contiene el resumen financiero de la venta |
| `pdpDetalle` | Partidas/parcialidades del PDP (cuotas mensuales). **Ver nota de arquitectura abajo** |
| `pagos` | Pagos reales realizados contra una partida del PDP. Fuente de verdad actual |
| `arrenPropiedades` | Relación de arrendamiento: qué nave está rentada y a quién |
| `arrePdp` | Plan de arrendamiento (contrato de renta). Contiene vigencia y montos |
| `arrePdpDetalle` | Partidas del contrato de arrendamiento |
| `actividad` | Tabla de auditoría. Registra acciones del usuario en el front (correo, pantalla, widget, comentario) |

---

## 3. Nomenclatura — ¡IMPORTANTE, CONTRAINTUITIVA!

### `arrenPropiedades.idArrendador` = INQUILINO, no arrendador

El campo `idArrendador` en la tabla `arrenPropiedades` apunta al **inquilino** (quien renta). El nombre es engañoso. En el contexto de negocio de SPH:
- El dueño de la nave está en `propiedades.idInversionista`
- El inquilino está en `arrenPropiedades.idArrendador`

Esto es nomenclatura interna heredada. No confundir.

### Nombres con mayúsculas = siempre entre comillas en SQL
```sql
-- Correcto:
SELECT "idArrePdp", "numNaveNAME" FROM "arrePdp"
-- Incorrecto:
SELECT idArrePdp FROM arrePdp
```

### Prefijos de funciones
Las funciones llevan como prefijo el nombre de la tabla que afectan:
```sql
CREATE OR REPLACE FUNCTION public.arrepdpdetalle_calcular_anio_por_plan(...)
```

---

## 4. Evoluciones Arquitectónicas Críticas

### 4.1 `pdp.pdpactivo` está DEPRECADO

**Historia**: En la arquitectura original, `pdp.pdpactivo` indicaba si un plan de pagos estaba activo. Sin embargo, una propiedad puede tener múltiples PDPs a lo largo del tiempo (si la nave se vende, el inversionista cumple, y luego se vuelve a vender a alguien más). El estado activo debe vivir a nivel de la **propiedad**, no del PDP individual.

**Decisión tomada**: El campo de verdad se movió a `propiedades.pdpActivo`.

**Estado actual**:
- `pdp.pdpactivo` está congelado en `false` para todos los registros
- `propiedades.pdpActivo` es la fuente de verdad
- Se planea eliminar `pdp.pdpactivo` de la tabla en el futuro
- **No usar `pdp.pdpactivo` para ninguna lógica**

### 4.2 `pdpDetalle.pago_monto` y `validado_monto` están DEPRECADOS

**Historia**: Originalmente los pagos se registraban directamente en `pdpDetalle` (un pago por parcialidad). Un cambio en las normas del negocio permitió **múltiples pagos parciales por parcialidad** (ej: el cliente paga $250k, $300k y $450k en diferentes días para cubrir una parcialidad de $1M).

**Decisión tomada**: Se creó la tabla `pagos` para registrar cada pago individual.

**Estado actual**:
- `pdpDetalle.pago_monto` y `validado_monto` son columnas legacy, **no se usan**
- La fuente de verdad de los pagos es `pagos.monto WHERE status = true`
- `pdp.montoPagado` = SUM(pagos.monto) WHERE idPdp = X AND status = true

### 4.3 Trigger de sincronización de `pdp.montoPagado`

Se implementó el trigger `trigger_pagos_actualizar_montopagado_pdp` sobre la tabla `pagos`. Este trigger actualiza automáticamente `pdp.montoPagado` en cada INSERT, UPDATE o DELETE de la tabla `pagos`.

**Función asociada**: `pagos_actualizar_montopagado_pdp()`

---

## 5. Campo `propiedades.tienenPdp` — Flag del Frontend

Este campo es un **flag de presentación para el frontend**. Si es `false`, el frontend NO muestra el plan de pagos al usuario, aunque existan registros en `pdp`.

- Valor `true`: el frontend muestra el PDP
- Valor `false`: el frontend no muestra nada (parece que no hay plan de pagos)

Este campo debe mantenerse sincronizado con la existencia real de un PDP activo en la propiedad.

---

## 6. Flujo de Pagos (Estado Actual)

```
Cliente realiza pago
       ↓
Se registra en tabla: pagos
  - idPdp: referencia al plan
  - idPdpDetalle: referencia a la parcialidad
  - monto: cantidad pagada
  - status: true (activo) / false (cancelado)
       ↓
Trigger: trigger_pagos_actualizar_montopagado_pdp
       ↓
Actualiza: pdp.montoPagado = SUM(pagos.monto WHERE status=true)
```

**Nota**: Es habitual en SPH que los operadores eliminen y re-registren pagos (el usuario `lcruz@gruposph.mx` lo hace regularmente). El trigger garantiza que `montoPagado` siempre esté sincronizado tras estas operaciones.

---

## 7. Consultas Útiles de Referencia

### Ver el PDP activo de una nave
```sql
SELECT 
  n."numNaveNAME",
  p."nomParque",
  inv."razonSocial",
  prop."pdpActivo",
  prop."tienenPdp",
  pdp."idPdp",
  pdp."montoPagado",
  pdp."montoTotal"
FROM "naves" n
JOIN "parques" p ON p."idParque" = n."idParque"
JOIN "propiedades" prop ON prop."idNave" = n."idNave"
JOIN "inversionista" inv ON inv."idInversionista" = prop."idInversionista"
LEFT JOIN "pdp" ON pdp."idPdp" = prop."idPdp"
WHERE n."numNaveNAME" = '91' AND p."nomParque" = 'Spartek II';
```

### Ver contratos de arrendamiento vigentes
```sql
SELECT 
  inv."razonSocial",
  n."numNaveNAME",
  p."nomParque",
  a."fecInicio",
  a."fecFin",
  CASE WHEN a."fecFin" >= CURRENT_DATE THEN 'Vigente' ELSE 'Vencido' END AS estatus
FROM "arrePdp" a
JOIN "arrenPropiedades" ap ON ap."idArrenProp" = a."idArrenProp"
JOIN "naves" n ON n."idNave" = ap."idNave"
JOIN "parques" p ON p."idParque" = n."idParque"
JOIN "inversionista" inv ON inv."idInversionista" = ap."idArrendador"
ORDER BY estatus, p."nomParque", n."numNaveNAME"::integer;
```

### Ver pagos reales de un PDP
```sql
SELECT 
  pg."idPago",
  pg."monto",
  pg."fecPago",
  pg."status",
  dd."numPartida"
FROM "pagos" pg
JOIN "pdpDetalle" dd ON dd."idPdpDetalle" = pg."idPdpDetalle"
WHERE pg."idPdp" = '<ID_DEL_PDP>'
ORDER BY pg."fecPago";
```

---

## 8. Parques del Sistema

| Nombre | Descripción |
|--------|-------------|
| Spartek | Parque original |
| Spartek II | Parque secundario (incluye naves: números + locales GYM, COWORKING) |
| Actitek | Parque industrial |
| Acupark I | Parque industrial |
| Acupark II | Parque industrial |
| Omega | Parque industrial |
| Sitapark | Parque industrial |
| Prueba Parque | Entorno de pruebas |

**Nota**: `numNaveNAME` no siempre es numérico. Spartek II tiene naves como "GYM", "COWORKING", "A", "B", "C". No hacer cast a INTEGER en ORDER BY sin verificar primero.

---

## 9. Problemas Conocidos / Deuda Técnica

| Problema | Estado | Notas |
|----------|--------|-------|
| `pdp.pdpactivo` deprecado | Pendiente eliminación | Congelado en false. No usar para lógica |
| `pdpDetalle.pago_monto` deprecado | Legacy | No usar. Fuente de verdad: tabla `pagos` |
| `pdpDetalle.validado_monto` deprecado | Legacy | No usar. Fuente de verdad: tabla `pagos` |
| Duplicados en inversionista | Parcialmente resuelto | Industrializadora Cacahuananche consolidado. Verificar otros duplicados periódicamente |
| DR CAR duplicado | Pendiente | idInversionista FWrdv4aWK8vIwTJ necesita consolidación con el registro principal de Fernando Gómez Serrano |

---

## 10. Usuario de Referencia para Testing

- **Email de prueba**: `jereff@aceleremos.com`
- **Rol**: Administrador del sistema

---

*Última actualización: 2026-05-28*
*Generado a partir de análisis del sistema durante sesión de diagnóstico Nave 91 Spartek II*
