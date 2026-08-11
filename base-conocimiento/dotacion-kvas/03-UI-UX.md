# 03 · UI / UX — Dotación de KVA por nave

> Anclado a `00-brief-conceptual.md`. Etiquetas exactas: §5 del brief.

## 1. Pantallas que cambian

| Pantalla | Ruta | Cambio |
|---|---|---|
| Alta de parque | `/parques` (modal) | Capturar la dotación por nave |
| Editar parque | `/parques` (modal) | Editar el default; aviso de que no re-aplica |
| Tablero de KVA | `/parques/kvas` | Filas «Dotado a naves» y «Sin dotar»; vencimientos |
| Ficha de la nave | modal desde el tablero | Editar dotación; renovar compromiso |

Ninguna pantalla nueva.

## 2. Alta de parque

Al bloque de capacidad se le suma uno de dotación, con el cálculo **en vivo** para que nadie
descubra el error al guardar:

```
┌─ Capacidad del parque ────────────────────────┐
│  KVA's Baja  [ 1017 ]    KVA's Media [ 4958 ] │
├─ KVA's por nave ──────────────────────────────┤
│  Baja        [    5 ]    Media       [    0 ] │
│                                                │
│  60 naves × 5 = 300 de baja · quedan 717 sin  │
│  dotar                                    ✓    │
└────────────────────────────────────────────────┘
```

- Valor propuesto: **5 de baja, 0 de media** (RF-1.1)
- Si excede: la línea de cálculo pasa a rojo y dice **cuánto sobra**; el botón Guardar se
  deshabilita. Nunca se deja intentar guardar algo que el backend rechazará.
- Texto de ayuda: *«Es lo que le toca a cada nave por disposición. Se puede cambiar nave por
  nave después.»*

## 3. Tablero de KVA — el bloque del parque

Se insertan dos filas. Orden pensado para leerse de arriba abajo como un embudo: lo que hay →
lo repartido → lo entregado → lo que queda.

```
CARGA                                     BAJA     MEDIA
Disponibilidad actual del parque          1,017    4,958
  Dotado a naves                            935    1,145
  Sin dotar                                  82    3,813   ← nuevo, gris
Ya asignados (ya hay contrato con CFE)      790    1,145
Comprometidos con inquilinos                  0        0
Por asignar                                 145        0
Disponibles actualmente                     227    3,813
```

- **Sin dotar** en gris: es informativo, no una alerta.
- **Disponibles** conserva el resaltado ámbar y el rojo si es negativo.
- Se elimina la nota «(no descuenta del disponible)» de «Por asignar»: con la dotación en la
  nave deja de ser cierta y deja de hacer falta.

## 4. Ficha de la nave — pestaña KVA

```
┌─ Nave 17 · POLLUX AUTOMATION ─────────────────┐
│  [ KVA ]  [ Documentos ]                       │
│                                                │
│  Dotación         Baja  10      Media  0  [✎]  │
│  ───────────────────────────────────────────   │
│  10 KVA · Baja · Vendido · Asignado (con CFE)  │
│           Contrato CFE 12345                   │
│           [Editar] [Cancelar] [Devolución]     │
│                                                │
│  5 KVA · Baja · Rentado · Comprometido         │
│           ⏳ Vence en 3 días · 18 ago           │
│           [Renovar] [Editar] [Cancelar]        │
│                                     [+ Asignar]│
└────────────────────────────────────────────────┘
```

- La **dotación** encabeza la pestaña: es el marco dentro del cual se asigna.
- El lápiz abre la edición en línea (permiso 721). Si el valor nuevo no cabe, el error dice
  el número exacto.
- **Vencimiento**: se muestran los días restantes. A **≤ 3 días**, en ámbar con ⏳. Vencido no
  se ve nunca: el cron ya lo borró.
- **Renovar** es un botón propio, no escondido en Editar: es la acción que el correo pide.

## 5. Estados

| Estado | Qué se ve |
|---|---|
| Parque sin dotación capturada | «Sin dotar» = capacidad completa; «Dotado a naves» en 0 |
| Nave sin dotación | «Dotación Baja 0 · Media 0» con el lápiz visible si hay 721 |
| Sin permiso 721 | La dotación se ve, el lápiz no aparece |
| Dotación excedida al editar | Error en línea: «La dotación de baja (940) supera la capacidad (935). Sobran 5 KVA.» |
| Compromiso por vencer | Fila con ⏳ ámbar y los días |
| Nave arrendada, se elige VENTA | El selector de figura queda fijo en Rentado con nota: «Esta nave está arrendada: a un arrendatario solo se le renta.» |

## 6. Accesibilidad y consistencia

- Se reusan `Badge`, el patrón de modal y la paleta del ERP; sin componentes nuevos.
- El ámbar de «por vencer» ya se usa para las devoluciones pendientes: mismo significado,
  mismo color.
- Los números siguen con `tabular-nums` y alineados a la derecha.
- El estado no se codifica **solo** con color: lleva icono (⏳) y texto («Vence en 3 días»).
