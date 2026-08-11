# 01 · PRD — Dotación de KVA por nave

> Anclado a `00-brief-conceptual.md`. Nomenclatura y decisiones cerradas: ver §3 y §5 del brief.

## 1. Problema

Quien administra los KVA no puede responder hoy tres preguntas del negocio:

1. **¿Cuánto le toca a esta nave por diseño?** Está mezclado con lo que un cliente ya tramitó.
2. **¿Cuánta capacidad del parque no le he repartido a nadie?** No se ve en ningún lado.
3. **¿Qué compromisos están por vencer?** No hay vencimiento: lo apartado se queda apartado
   para siempre y bloquea capacidad que debería volver al pool.

## 2. Requisitos funcionales

### RF-1 · Capturar la dotación al dar de alta un parque
Al crear un parque, además del nombre, domicilio, número de naves y capacidad, se capturan
**los KVA de baja y de media que llevará cada nave**. El sistema los aplica a todas las naves
que genera.
- **RF-1.1** El valor propuesto por defecto es **5 de baja y 0 de media**, editable antes de guardar.
- **RF-1.2** Si `naves × dotación > capacidad`, el alta se rechaza con un mensaje que dice
  cuánto falta de capacidad (ver RF-5).

### RF-2 · Editar la dotación de una nave
Desde la ficha de la nave se puede cambiar su dotación de baja y de media, con permiso **721**.
- **RF-2.1** No puede quedar por debajo de lo ya asignado + comprometido en esa nave.
- **RF-2.2** No puede hacer que la suma del parque supere la capacidad (RF-5).

### RF-3 · Ver el reparto completo del parque
El tablero de KVA muestra, por parque (o pool):

| Fila | Cálculo |
|---|---|
| Capacidad del parque | `parques.kvas*` |
| Dotado a naves | Σ `naves.dotacion*` |
| **Sin dotar** | capacidad − dotado |
| Ya asignados (con CFE) | Σ asignaciones `ASIGNADO` |
| Comprometidos con inquilinos | Σ asignaciones `COMPROMETIDO` |
| Por asignar | dotado − asignado − comprometido |
| **Disponibles actualmente** | capacidad − asignado − comprometido |

### RF-4 · Apartar KVA con vencimiento
Al registrar una asignación en etapa **Comprometido** se fija su vencimiento a **10 días**.
- **RF-4.1** El listado muestra los días que faltan; a 3 días o menos se destaca visualmente.
- **RF-4.2** Se puede **renovar** (permiso 721): reinicia los 10 días y lo registra en auditoría.
- **RF-4.3** Un proceso diario **borra** los compromisos vencidos y libera su capacidad.
- **RF-4.4** Antes de vencer se envía **correo al usuario que apartó**.

### RF-5 · La dotación nunca excede la capacidad
`Σ dotación de las naves ≤ capacidad`. Se valida en los cuatro momentos:
crear parque · editar dotación de nave · bajar capacidad del parque · agregar naves.
- **RF-5.1** Si el parque **comparte acometida** con otro, la restricción se evalúa sobre la
  suma de ambos (capacidad combinada vs. dotación combinada).
- **RF-5.2** El mensaje de error dice el número concreto: cuánto se intenta dotar, cuánta
  capacidad hay y cuánto sobra.

### RF-6 · Al arrendatario no se le vende
Si la nave está arrendada, la figura de una asignación nueva o editada solo puede ser **RENTA**.
El intento de capturar VENTA se rechaza explicando por qué.

## 3. Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA-1 | Un parque nuevo de 10 naves, capacidad 100 baja | Se captura dotación 5 de baja | Se crea con 10 naves de 5 = 50 dotados, 50 sin dotar |
| CA-2 | El mismo parque | Se captura dotación 15 de baja | Se rechaza: 150 > 100, faltan 50 |
| CA-3 | Una nave con 10 dotados y 10 asignados | Se intenta bajar su dotación a 5 | Se rechaza: ya tiene 10 comprometidos con clientes |
| CA-4 | Spartek I (600 dotados, 488 de capacidad propia) | Se valida la restricción | **Pasa**: comparte acometida con Spartek II y el pool da 935 ≤ 1,017 |
| CA-5 | Un compromiso creado hace 11 días | Corre el proceso diario | Se borra y su capacidad vuelve al disponible |
| CA-6 | Un compromiso que vence en 2 días | Corre el proceso diario | Se envía correo a quien apartó; el compromiso sigue vivo |
| CA-7 | Una nave arrendada | Se captura una asignación con figura VENTA | Se rechaza indicando que al arrendatario solo se le renta |
| CA-8 | Spartek I & II tras migrar | Se abre el tablero | Por asignar **145** · Disponibles **227** · Sin dotar **82** |

## 4. Alcance MVP vs. fases futuras

**MVP (este paquete)**
- Dotación por nave con su default de parque, editable y validada
- Depuración de `POR_ASIGNAR` a dotación
- Vencimiento, renovación, borrado automático y correo de compromisos
- Validación arrendatario → solo renta
- Tablero con las filas nuevas

**Fases futuras (fuera)**
- Importador configurable de Excel
- Áreas comunes como concepto propio
- Disponibilidad futura de parques en construcción
- Histórico de cambios de dotación como vista (hoy queda en `auditoria`)

## 5. Fuera de alcance explícito

Montos de renta/venta de KVA · separar «conjunto» de «acometida» · notificaciones que no sean
el correo de vencimiento · aprobación de un rol superior para renovar.
