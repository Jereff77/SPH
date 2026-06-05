---
modulo: Arrendatarios
estado: stub
version_doc: 0.1
ultima_actualizacion: 2026-06-04
rutas_v1: [i02_arrendatarios]
tablas: [arrenPropiedades, arrePdp, arrePdpDetalle, inversionista, v_arreNavConPdp, v_arrendadasNaves, v_rentasCombinadas, v_rentasGarantizadas]
palabras_clave: [arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, vigencia, meses de gracia, INPC]
relacionado_con: [parques, inversionistas, cxp]
---

# Módulo: Arrendatarios  — (STUB, pendiente en v2)

> ⚠️ **Estado: NO desarrollado en v2.** Existe en v1. Ficha mínima; derivar a soporte para operaciones.

## Qué hace (en v1)
Gestiona los **arrendamientos** de naves: contratos de renta, planes de pago de renta (**arrePdp**),
vigencias, meses de gracia, actualización por **INPC** y asignación de pagos de renta.

## Entidades y tablas principales
- `arrenPropiedades` (vínculo nave↔arrendatario; PK `idNavArrend`; `idArrendador`).
- `arrePdp`, `arrePdpDetalle` (plan de pagos de renta, conceptos, vigencia).
- Vistas `v_arreNavConPdp`, `v_arrendadasNaves`, `v_rentasCombinadas`, `v_rentasGarantizadas`.

## ⚠️ Gotcha clave
**`idArrendador = idInversionista`**: el arrendatario es un registro de la tabla `inversionista`; su
nombre se obtiene de `inversionista.razonsocial`. (En la UI vieja aparecía como "Arrendador"; el término
correcto es **arrendatario**.)

## Relación con lo ya desarrollado
- **Parques:** en la tarjeta/tablero de una nave, el "arrendatario" se resuelve desde aquí
  (`arrenPropiedades.idArrendador` → `inversionista.razonsocial`).

## Para el agente
Explicar a alto nivel; para operaciones de renta, **levantar ticket** o remitir a v1 mientras no se migre.
