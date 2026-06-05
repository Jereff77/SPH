---
modulo: Inversionistas / Propietarios
estado: stub                 # existe en v1, AÚN NO migrado a v2
version_doc: 0.1
ultima_actualizacion: 2026-06-04
rutas_v1: [i01_inversionistas]
tablas: [inversionista, propiedades, v_propiedades, pdp, pdpDetalle, v_pdpdetalle, naves]
palabras_clave: [inversionista, propietario, dueño, propiedad, escrituración, plan de pagos, PDP, reporte, rentas garantizadas]
relacionado_con: [parques, arrendatarios, cxp, fideicomiso]
---

# Módulo: Inversionistas / Propietarios  — (STUB, pendiente en v2)

> ⚠️ **Estado: NO desarrollado en la versión nueva (v2).** Existe en v1 (FlutterFlow). Esta ficha es
> mínima para que el agente sepa que el módulo existe, de qué trata y **derive a soporte** cuando se
> pregunte por funcionalidad concreta. Se completará al migrarlo.

## Qué hace (en v1)
Gestiona a los **inversionistas** (dueños) y sus **propiedades**: asignar un inversionista a una nave
(la nave pasa a `Vendida`), escrituración, planes de pago de compra (**PDP**), rentas garantizadas/
administradas y reportes de rendimiento.

## Entidades y tablas principales
- `inversionista` (PK `idInversionista`, `razonsocial`). ⚠️ El mismo registro funge como **arrendatario**
  en el módulo de Arrendatarios (`idArrendador = idInversionista`).
- `propiedades` (vínculo nave↔inversionista; PK `idPropiedad`). Vista `v_propiedades`.
- `pdp`, `pdpDetalle`, `v_pdpdetalle*` (plan de pagos de compra y estados de cuenta).

## Relación con lo ya desarrollado
- **Parques:** el "dueño" de una nave (`razonsocial` en `v_naves`) viene de aquí; poner una nave en
  `Vendida` se hace **desde este módulo**, no desde el editor de naves.

## Para el agente
Mientras no esté en v2: explicar a alto nivel y, para operaciones, **ofrecer levantar ticket** o remitir
al sistema v1.
