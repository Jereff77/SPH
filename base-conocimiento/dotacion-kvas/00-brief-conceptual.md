# 00 · Brief conceptual — Dotación de KVA por nave

> **Fuente de verdad del paquete.** Los demás documentos se anclan aquí y no
> inventan nomenclatura alternativa. Si algo se contradice, manda este archivo.
>
> Fecha: 2026-08-08 · Autor: Toribio (Opus 5) · Estado: **pendiente de aprobación de Jereff**

---

## 1. Por qué existe este cambio

El módulo de KVA (v2.60.0–v2.65.0) modeló **todo** como asignaciones: tanto los KVA que
un cliente ya tramitó ante CFE como los que simplemente "le tocan" a la nave por diseño
del parque. Ambos viven hoy en `kvasAsignados`, separados solo por la columna `etapa`.

Al conciliar contra el control operativo del cliente (2026-08-07) el tablero nunca cuadró:
`Ya asignados` daba 565 contra 790, y `Por asignar` 380 contra 290. La causa no era un
error de cálculo sino **de modelo**, y la reveló el propio negocio:

> «*Asignados contratos venta*: son los KVA que **por disposición se estipuló que tendría
> cada nave** del parque.» — Jereff, 2026-08-07

Eso no es un movimiento: es un **atributo de la nave**. Modelarlo como asignación obliga a
capturar a mano algo que debería calcularse, y hace que dos conceptos distintos compitan
por la misma tabla.

## 2. El concepto central: DOTACIÓN

**Dotación** = los KVA que le corresponden a una nave por disposición del parque, tenga o
no un cliente detrás. Es capacidad **reservada por diseño**, no entregada.

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **Capacidad** | Lo que el parque tiene contratado con CFE | `parques.kvasMt` / `kvasBt` (ya existe) |
| **Dotación** | Lo que le toca a cada nave por diseño | `naves.dotacionMt` / `dotacionBt` (**nuevo**) |
| **Asignación** | Lo que un cliente realmente tiene o apartó | `kvasAsignados` (se depura) |

## 3. Decisiones CERRADAS (acordadas con Jereff, 2026-08-07/08)

1. **La dotación se pregunta al dar de alta el parque**, en KVA por nave, para los dos
   niveles. Nace igual en todas sus naves y **se edita nave por nave** después.
2. **La capacidad del parque también se pregunta al darlo de alta** (ya se hace hoy) y es
   editable.
3. ⛔ **Σ dotación de las naves ≤ capacidad.** Menor sí, mayor no.
   Cuando dos parques **comparten acometida**, la restricción se evalúa sobre el **pool**,
   no parque por parque (ver decisión 4).
4. **Spartek I y II van en combo**: es el mismo lugar físico —la entrada a II es por el I—
   y un solo pool de 1,017 KVA de baja. La **acometida** es lo que los agrupa.
5. **`POR_ASIGNAR` desaparece como etapa.** `kvasAsignados` guarda solo hechos reales:
   `ASIGNADO` y `COMPROMETIDO`. Lo "por asignar" pasa a calcularse.
6. **Al arrendatario no se le vende.** Si el ocupante de la nave es arrendatario, la figura
   solo puede ser `RENTA`.
7. **Los compromisos caducan a los 10 días** desde que se apartan. Son **renovables**. Antes
   de vencer se **notifica por correo** a quien apartó. Al vencer, el cron **borra** el
   compromiso — «para que la suma nos dé correcto» (Jereff). El rastro queda en `auditoria`,
   que registra el DELETE con la fila completa.
8. **Permiso 721** (el mismo de asignar) para editar la dotación.
9. **Nomenclatura confirmada: MT = MEDIA, BT = BAJA.** No existe un tercer nivel; «alta» fue
   un lapsus y se descarta del vocabulario del módulo.

## 4. Fórmulas canónicas

```
Por asignar (parque)  = Σ dotación de sus naves − Σ asignado − Σ comprometido
Por asignar (nave)    = dotación − asignado − comprometido
Disponibles (parque)  = capacidad − Σ asignado − Σ comprometido
Sin dotar (parque)    = capacidad − Σ dotación        ← dato nuevo, hoy invisible
```

Con los datos reales de Spartek I & II (baja):

| | |
|---|---|
| Capacidad (pool) | 1,017 |
| Σ dotación | 935 |
| Asignado | 790 |
| Comprometido | 0 |
| **Por asignar** | 935 − 790 = **145** |
| **Disponibles** | 1,017 − 790 = **227** |
| **Sin dotar** | 1,017 − 935 = **82** |

📌 El Excel del cliente muestra 290 y 372 en esas dos filas. **Jereff confirmó que ese
cálculo está mal en su hoja** y que manda la definición conceptual, no la fórmula heredada.

## 5. Nomenclatura canónica (usar EXACTAMENTE estos nombres)

| Concepto | Columna / clave | Etiqueta en pantalla |
|---|---|---|
| Capacidad media del parque | `parques.kvasMt` | «KVA's Media» |
| Capacidad baja del parque | `parques.kvasBt` | «KVA's Baja» |
| Dotación media de la nave | `naves.dotacionMt` | «Dotación media» |
| Dotación baja de la nave | `naves.dotacionBt` | «Dotación baja» |
| Default del parque (media) | `parques.dotacionMtNave` | «KVA's de media por nave» |
| Default del parque (baja) | `parques.dotacionBtNave` | «KVA's de baja por nave» |
| Vencimiento del compromiso | `kvasAsignados.venceCompromiso` | «Vence el» |
| Días de vigencia | constante `DIAS_COMPROMISO = 10` | — |

⛔ **Prohibido** introducir sinónimos: no usar «paquete», «cuota», «alta tensión»,
`kvasAlta`, `kvasMedia` ni `POR_ASIGNAR` en código nuevo.

## 6. Qué NO entra en este alcance

- Áreas comunes como concepto propio (caseta, alumbrado, PTAR): hoy son naves normales.
- Disponibilidad futura de parques en construcción (fila «TENTATIVO» del Excel).
- Montos de renta/venta de KVA.
- El importador configurable de Excel — es un módulo aparte, ya identificado como necesario
  porque «la gente de SPH es muy dada a cambiar los formatos» (Jereff, 2026-08-07).
- Separar el concepto de «conjunto de parques» del de «acometida». Hoy coinciden en la
  operación real; se separa el día que diverjan.

## 7. Riesgo de arrastre que este cambio corrige

En v2.65.0 se hizo que `POR_ASIGNAR` **no descontara** del disponible, para replicar la
fórmula del Excel. Fue un **parche sobre un modelo equivocado**: con la dotación viviendo en
la nave, no hay nada que excluir y `kva_consumo` vuelve a ser simple (todo lo vivo consume).
Este paquete elimina el parche, no lo hereda.
