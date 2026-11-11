# 03 — UI/UX: Traspaso de depósito de garantía

> Anclado a `00 v2`. Rutas relativas a `version2/apps/web/src/`. Marca real: `base-conocimiento/modulos/branding.md`
> (azul `#1f2a4d`, tablas con encabezado sticky blanco sobre azul). **El visual es un wireframe HTML (`mockup.html`, §8).**

## 1. Reglas de UI que se respetan (`.sessions/contexto.md` §1, reglas 7–7d + `reglas-ui` global)

- Modales con el componente compartido `components/ui/Modal.tsx` (portal sobre `body`, Escape, foco atrapado,
  `cabeceraAzul`) para los modales **nuevos** («Traspasar depósito» y «Revertir traspaso»). `RenovarPlanModal` **conserva su
  contenedor actual** (`div fixed`, `rounded-2xl`, botones dentro del formulario): Jereff pidió el 2026-10-20 que lo existente
  **no cambie de aspecto**. La migración al `Modal` en portal no es parte de esta entrega (desvío previo de la regla de portal).
- Fechas: mostrar con `fechaCorta()`, capturar con `components/InputFecha.tsx` (dd/mm/aaaa; nunca `type="date"`).
- **Todo importe lleva su divisa** (`moneda(n, divisa)`). Los depósitos tienen hasta 4 decimales (237,002.955):
  se añade `montoExacto(n, divisa)` (mín. 2, máx. 4 decimales) para que 2 × 237,002.955 = 474,005.91 **se vea
  cuadrado**; `moneda()` (2 decimales) mostraría 474,005.92.
- Scroll interno sin barra (`scrollbar-hide`); no hay campos numéricos: **la persona elige, no teclea** (D3).
- Orígenes = **elección** entre candidatos (casillas), nunca códigos tecleados.
- Listas de selección (≤ 6 filas) y la lista de traspasos del plan usan `THEAD_STICKY`/`THEAD_TR`. **Excepción a
  confirmar**: no llevan filtro por columna ni exportación (no son tablas de datos; el reporte «Traspasos de
  depósito» con filtros y Excel/PDF es fase 2, 00 §7).

## 2. Componente compartido `TraspasoDepositoForm.tsx` (D1: un solo formulario para ambos usos)

Props: `candidatos`, `depositoDestino` (cantidad + divisa), `valor`/`onChange`, `modo: 'renovar' | 'manual'`.

1. **Lista de candidatos** (tabla: casilla · Nave/contrato · Periodo `dd/mm/aaaa – dd/mm/aaaa` · Etiqueta · Disponible).
   Etiquetas: «Mismo contrato (renovado)», «Misma nave», «Nave hermana · vence el mismo día».
   Filas **bloqueadas** (casilla deshabilitada + motivo en texto): otra moneda · «Depósito en 0 en la corrida, el
   contrato dice $X» (muestra ambos montos) · ya traspasado · estructura no estándar.
2. **Complemento resultante** (grande, fijo bajo la lista): `Depósito del nuevo contrato − Σ disponible elegido`
   = «**Por cobrar en efectivo: $26,639.11 MXN**». Si la suma supera el depósito: banner rojo «Lo que eliges ($X) supera
   el depósito del nuevo contrato ($Y). Quita un origen o ajusta el depósito nuevo» y se **bloquea** confirmar (D3).
3. **Nota obligatoria** (≥ 10 caracteres, contador; ayuda: «Folio o número de contrato del depósito anterior»).
4. **Fecha del traspaso** (`InputFecha`, hoy por defecto, no futura).
5. **Casilla de confirmación** (sin marcar por defecto): «Confirmo que el depósito del contrato anterior fue recibido».
6. En `modo='renovar'`: el plan que se renueva sale **preseleccionado**; las naves hermanas salen **sin marcar** con
   la etiqueta «Posible adicional»; nada se envía si no hay casilla y nota válidas.

## 3. `RenovarPlanModal.tsx` (D1, D11, D12)

- Nueva sección **«Traspasar depósito de contratos anteriores»** bajo el campo *Depósito garantía*. Se muestra solo
  si `tienePermiso(23) && tienePermiso(25)`, el depósito nuevo > 0 y hay candidatos. Recalcula el complemento al
  cambiar el depósito o la moneda (la moneda distinta bloquea candidatos).
- **Estado de resultado** (el modal ya **no** se cierra tras el éxito; hoy `onClose()` pierde el aviso):
  - Plan creado ✓ + traspaso ✓: «Renovación registrada · Depósito traspasado $474,005.91 · Por cobrar $26,639.11» → [Cerrar].
  - Plan creado ✓ + traspaso ✗: «Renovación registrada ✓ · **El traspaso no se aplicó**: <motivo en claro>» →
    [Reintentar traspaso] [Cerrar]. *Reintentar* usa la misma clave y **no** vuelve a crear el plan.
  - Sin traspaso: como hoy, con mensaje de éxito visible antes de cerrar.
- Los datos de renta/administración del formulario se bloquean tras crear el plan (no se puede «registrar» dos veces).

## 4. Botón y modal «Traspasar depósito» (`ArrendatariosPage.tsx`)

- Botón en la barra «Planes de esta propiedad», junto a *Renovar*, **solo** si `tienePermiso(25)` y el plan
  seleccionado (`planSel`) tiene depósito por cobrar > 0 sin `fecPago`. Tooltip: «Mueve el depósito de contratos
  anteriores a este contrato».
- Modal (`Modal`, ancho `lg`, cabecera azul) «Traspasar depósito · <arrendatario> · <nave>»: arriba el resumen del
  destino (§5), luego `TraspasoDepositoForm modo='manual'`. Pie: [Cancelar] [Traspasar depósito] (deshabilitado
  hasta que haya selección válida, nota, casilla y complemento ≥ 0).
- Confirmación en un solo paso (el formulario ya es la confirmación); tras éxito: aviso «Depósito traspasado ·
  Por cobrar $X» y se refrescan `['arre-planes']`, `['arre-resumen', id]`, `['arre-deposito', id]`, `['notas','historial', id]`
  y las consultas de cobranza. La clave de idempotencia (UUID) se genera al abrir el modal y se renueva tras un rechazo
  4xx definitivo.

## 5. Resumen «Depósito contractual · Traspasado · Por cobrar» (D14)

**Franja** nueva `ResumenDeposito.tsx` (mismo patrón que la franja verde de incrementos INPC que ya existe: `rounded-xl border
px-4 py-2 text-xs`, tonos `#eef3fb`/`#c9d6ee`), con enlace «Ver traspasos» que despliega la lista; va sobre la tabla de la corrida
(`CorridaPlan`), visible si el plan tiene
depósito o traspasos. Tres cifras con divisa: **Depósito contractual** `$500,645.02` · **Traspasado** `$474,005.91`
· **Por cobrar** `$26,639.11`. Debajo, la lista de traspasos del plan:

| Columnas | Origen/destino (nave, periodo) · Monto · Fecha · Nota · Registró · Estado · [Revertir] |
|---|---|
| **Destino** | filas «Recibido de <nave, periodo>». [Revertir] (permiso 25) abre §6. |
| **Origen** | nota gris «Este depósito se traspasó a <nave, periodo>: $T» (sin acción; se revierte desde el destino). |
| **Pagada por traspaso** | etiqueta verde «Pagado por traspaso el <fecha>» (sin pago bancario). |

La fila 0 de la corrida (`PartidaFila`) conserva su monto (= complemento) y añade la nota «Traspaso de …: T».

## 6. Modal «Revertir traspaso»

`Modal` pequeño: datos del traspaso (monto, origen, fecha, nota), consecuencia en texto («El contrato destino volverá
a tener por cobrar $X; el depósito del origen quedará disponible de nuevo»), **motivo obligatorio** (≥ 5) y
[Cancelar] [Revertir]. Errores con texto claro: «Primero desaplica el pago del depósito en Registro de movimientos»
(`PAGO_APLICADO`) · «Revierte primero el traspaso que el destino hizo a otro contrato» (`DESTINO_YA_EMITIO`) ·
«Revierte primero el traspaso del <fecha> que dejó el depósito en 0» (`REVERTIR_ANTES_OTRO`).

## 7. Otras pantallas

- **Historial** (`PanelNotas`): renglón «Depósito traspasado — $474,005.91 MXN desde <nave, periodo> · nota» y
  «Traspaso revertido — motivo», con autor y hora; icono propio (flechas en sentido contrario) en `ESTILO_EVENTO`.
- **Aplicar pago** (`AplicarPagoModal.tsx`): la partida reducida se etiqueta «Depósito (complemento; $474,005.91
  traspasados)»; los depósitos ya traspasados **no aparecen** (D6).
- **Estado de cuenta** (pantalla, PDF, Excel): el renglón 0 lleva texto corto en la columna **Nota que ya existe**
  («Traspaso $T (N contratos)»; la columna trunca a 16 rem) y la cabecera suma dos datos: «Traspasado» y «Depósito por cobrar».
  Sin columnas nuevas ni cambios de formato.
- **Errores/avisos**: texto debajo del campo o banner en el modal (no `window.alert`); 409 «Cambió mientras operabas»
  ofrece [Recargar] que vuelve a pedir candidatos.

## 8. Mockup — wireframe HTML (excepción de Jereff, 2026-10-20)

> El servidor MCP de Pencil no logró conectarse a la extensión de VS Code (9 intentos; la app «Pen» sí tenía el archivo abierto, pero el
> MCP está configurado para `visual_studio_code`). Jereff indicó **«continúa sin Pencil»**. Las 11 pantallas están dibujadas en
> **[mockup.html](mockup.html)** (marca real de `branding.md`, cifras reales de Deumex). `traspaso_deposito.pen` queda vacío; si Pencil
> conecta más adelante, se migra el visual. Lista original de frames (**todos cubiertos en el wireframe**):

No se inventa el visual. Archivo a crear: `docs/traspaso-deposito/traspaso-deposito.pen`, con la marca de
`branding.md` y los componentes reales (`Modal`, tablas `THEAD_STICKY`). Frames a diseñar:

1. Renovar · sección de traspaso (sugerencia: renovado preseleccionado + hermanas «posible adicional»)
2. Renovar · complemento resultante y error «supera el depósito nuevo»
3. Renovar · resultado ✓/✓ y resultado ✓/✗ con [Reintentar]
4. Modal «Traspasar depósito» (vacío, con selección, sin candidatos)
5. Candidatos bloqueados (otra moneda · depósito en 0 con ambos montos · ya traspasado)
6. Tarjeta «Depósito contractual · Traspasado · Por cobrar» (destino con 2 traspasos · origen · pagado por traspaso)
7. Modal «Revertir traspaso» (normal y con error `PAGO_APLICADO`)
8. Renglón de Historial (traspaso y reversa)
9. Aplicar pago con «Depósito (complemento …)»
10. Estado de cuenta (renglón 0 con nota + resumen D14; versión PDF)
11. Banner de error 409 / «Cambió mientras operabas»
