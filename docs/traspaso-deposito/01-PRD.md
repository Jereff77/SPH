# 01 — PRD: Traspaso de depósito de garantía

> Anclado a `00-brief-conceptual.md` **v2** (no lo contradice; se cita como «00 §5 D3»).
> Estado: **aprobado y construido (v2.81.0, 2026-11-11).**
> Redactó: Nicanor (Sonnet) para Toribio, 2026-10-20.

## 1. Qué se construye

Una herramienta para que el equipo de arrendatarios **mueva en papel un depósito de garantía ya recibido**
de contratos anteriores al depósito de un contrato nuevo, y que el sistema cobre **solo el complemento**.
Ejemplo Deumex (00 §6): depósito nuevo 500,645.02 − 474,005.91 traspasados = **26,639.11 por cobrar**.
No entra dinero al banco; no se mueve ningún dato existente si nadie ejecuta un traspaso (00 §1).

## 2. Para quién

| Quién | Qué hace con esto |
|---|---|
| **Mónica Echeverry y el equipo de arrendatarios** (permiso 25; en *Renovar*, 23 y 25) | Traspasan, revierten y consultan; corrigen caso por caso lo que ya existe. |
| **Jereff (cliente)** | Define alcance, decide lo abierto (00 §9) y **acepta** el producto. |
| **Soporte de la plataforma** | Ve y opera lo mismo que el equipo (regla global); sus acciones quedan a su nombre. |

## 3. Alcance de la v1

1. **Al renovar**, el modal sugiere los depósitos de origen; la persona elige y confirma (00 D1, D12).
2. **Botón «Traspasar depósito»** en cualquier contrato destino ya creado (00 D1).
3. La persona **elige orígenes, no teclea montos**: se traspasa el depósito disponible completo de cada uno (D3).
4. El sistema muestra en grande el **complemento por cobrar** antes de confirmar.
5. **Revertir** un traspaso con motivo (D8) y **ver** el resumen «Depósito contractual · Traspasado · Por cobrar» (D14).
6. *Aplicar pago* y la cobranza **ya no ofrecen cobrar** lo traspasado; el complemento sale etiquetado (D6, D16).
7. Todo queda **auditado** y aparece en el *Historial* del contrato (D2, D10).
8. *Aplicar pago* se vuelve atómico (D9) para que un traspaso simultáneo no deje saldo bancario perdido.

## 4. Criterios de aceptación (lenguaje de negocio)

1. **Deumex**: al traspasar los depósitos de nave A 2025 y nave B 2025 al contrato nave A 2026, el sistema deja
   por cobrar **exactamente 26,639.11** (no 26,639.12 ni 263,642.07) y el modal de *Aplicar pago* lo ofrece como
   «Depósito (complemento)».
2. Nave 18 (97,710 → 97,710): el contrato destino queda con **0 por cobrar** y marcado como pagado por traspaso.
3. Un depósito **ya traspasado nunca vuelve a ofrecerse** para cobrar ni para traspasar; no hay doble cobro.
4. No se puede traspasar entre **arrendatarios distintos**, **monedas distintas**, contratos aún vigentes en
   paralelo, ni más de lo que vale el depósito nuevo (mensaje claro, sin tecnicismos).
5. Sin la nota (≥10 caracteres, p. ej. folio) y la casilla «Confirmo que el depósito del contrato anterior fue
   recibido», **no se puede confirmar**.
6. Dos personas, o un doble clic, **no duplican** un traspaso.
7. Si el traspaso falla tras renovar, el contrato **queda creado**, la pantalla lo dice y ofrece **Reintentar**.
8. **Revertir** devuelve el depósito al contrato destino y lo deja disponible en el origen; si ya se cobró el
   complemento, el sistema pide primero *Desaplicar pago*.
9. No se puede **eliminar** un contrato con traspasos ni **cambiar su moneda / editar a mano** el depósito
   traspasado (solo en esos casos; todo lo demás se comporta igual).
10. El *Estado de cuenta* explica el renglón del depósito («Traspaso de …: T») y muestra el resumen D14.
11. **Cero** cambios en datos existentes por la migración; ningún contrato cambia si nadie traspasa.
12. Cada traspaso y reversa muestra **quién, cuándo y por qué** en el *Historial* del contrato.

## 5. Fuera de alcance (00 §7, sin ampliar)

Devolución de depósito / excedente · carga del depósito «recibido antes de la plataforma» (145 planes) · limpieza
de depósitos fantasma · pantalla-reporte «Traspasos de depósito» y segundo aprobador · tabla nueva en la fuente
del agente de soporte · lo ajeno al traspaso que se detectó queda fuera de este PRD.

## 6. Limitaciones conocidas y decisiones abiertas

- **Limitación v1** (00 §9.3): si lo traspasable supera el depósito nuevo, **se bloquea**; se resuelve ajustando
  el depósito nuevo o devolviendo fuera del sistema.
- **Orígenes con depósito en 0** en la corrida pero con depósito en el contrato (21 planes): no se pueden usar
  hasta la fase «depósito previo»; el sistema muestra ambos montos y lo explica.
- **Abiertas para Jereff** (00 §9): segundo visto bueno (recomendado: no en v1) · endurecer *Aplicar pago*
  (D9, vetable) · aceptar la limitación v1.
- **Éxito** = Mónica corrige Deumex y los otros 5 clientes con consolidación multinave sin tocar la BD a mano.
