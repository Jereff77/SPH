# 01 · PRD — Plantillas de documentos de KVA's

> Anclado a `00-brief-conceptual.md` (fuente de verdad; decisiones D1–D9 cerradas, no se reabren aquí).
> Estado: **DISEÑO — sin construir.** Visual aprobado: `plantillas.pen` (01 listado · 02 editor · 03 generar).
> Este documento dice **qué** y **para quién**. El cómo (tablas, endpoints, motor de PDF) es del TRD/BACKEND.

## 1. Problema

Hoy la carta «Asignación de Carga» a CFE (y su contraparte de devolución) se arma **a mano en Word**
cada vez: se copia la carta de otra empresa, se cambian a ojo la razón social, los números de nave, los
KVA y el nivel de tensión, y se exporta a PDF que alguien sube después al expediente de la nave.
Consecuencias para el negocio:

1. **Errores de captura** en datos que ya existen en el ERP (razón social, naves, KVA, tensión, fecha).
2. **Tiempo repetido**: una empresa con 8 naves implica reescribir la lista de naves y revisar cada KVA.
3. **Sin control de versiones**: nadie sabe qué texto se mandó a CFE ni de qué machote salió.
4. **Sin rastro en el expediente**: el documento enviado vive en el correo o en una carpeta personal,
   no en la nave a la que pertenece.

## 2. Usuarios y roles

| Rol | Qué hace en este módulo | Permiso (a confirmar en el TRD, brief §6) |
|---|---|---|
| **Quien administra KVA's** | Crea, edita, duplica y da de baja plantillas; también genera documentos | Plantillas · ver / editar + el de usar plantilla |
| **Quien asigna KVA's** | Edita plantillas (D3) y genera documentos para una empresa | Plantillas · ver / editar + el de usar plantilla |
| **Quien solo consulta** | Ve el PDF en el expediente de la nave | Permiso de ver documentos de nave (el del expediente) |
| **Soporte de la plataforma** | Ve y opera todo, con trazabilidad a su nombre (regla global) | Fuera de la matriz |

Ambos roles editores (D3) comparten las mismas plantillas: no hay plantillas «personales».

## 3. Historias de usuario y criterios de aceptación

Convención: **HU** = historia; **CA** = criterio verificable (Dado / Cuando / Entonces).
Tipos de plantilla vigentes: `ASIGNACION_CARGA` y `DEVOLUCION` (D1). En v1 `DEVOLUCION` queda
declarada sin campos propios (D14).

### HU-1 · Crear una plantilla
*Como quien administra o asigna, quiero crear una plantilla de un tipo para no reescribir la carta cada vez.*

- **CA-1.1** Dado que tengo permiso de editar plantillas, cuando entro a **Parques → Plantillas** y elijo
  «Nueva plantilla», entonces puedo capturar nombre y elegir tipo **solo entre los de la lista fija** (D1);
  no existe opción para crear tipos nuevos.
- **CA-1.2** Cuando guardo, la plantilla aparece en el listado con su tipo, su **versión 1**, quién la
  creó y la fecha, y queda en estado vigente.
- **CA-1.3** Si dejo el nombre vacío o repito el nombre de otra plantilla vigente del mismo tipo, el
  guardado se rechaza con un mensaje que dice qué corregir (la regla de unicidad exacta: PA-3).
- **CA-1.4** Sin permiso de editar, el botón «Nueva plantilla» no se pinta y el intento directo se rechaza
  con 403.
- **CA-1.5** La creación queda auditada con mi identidad (no con una genérica).

### HU-2 · Editar una plantilla (genera versión nueva)
*Como editor, quiero corregir el texto del machote sin perder lo que ya se mandó.*

- **CA-2.1** Dado una plantilla en versión *n*, cuando guardo un cambio, entonces existe la versión *n+1* con
  el texto nuevo y la versión *n* **sigue existiendo sin cambios** (regla 5 del brief).
- **CA-2.2** El listado muestra siempre la versión vigente y puedo consultar el historial de versiones
  (quién, cuándo) en modo solo lectura.
- **CA-2.3** Un documento ya generado con la versión *n* **no cambia** ni se regenera al editar la
  plantilla.
- **CA-2.4** Si dos personas editan a la vez, la segunda en guardar **no sobrescribe en silencio** la
  versión de la primera: recibe aviso y decide (comportamiento exacto en `04-FLUJOS` F-7; política final: PA-4).
- **CA-2.5** Sin cambios reales en el texto, «Guardar» no crea una versión nueva.

### HU-3 · Duplicar una plantilla
*Como editor, quiero partir de una plantilla existente para crear una variante (otra redacción u otro apoderado).*

- **CA-3.1** Desde el listado, «Duplicar» crea una plantilla **nueva e independiente** del mismo tipo, con
  el mismo texto y datos fijos, en versión 1, con un nombre que indica que es copia.
- **CA-3.2** Editar la copia **no afecta** a la original ni al revés.
- **CA-3.3** La duplicación queda auditada con quien la hizo.

### HU-4 · Dar de baja una plantilla
*Como editor, quiero retirar una plantilla que ya no se usa sin borrar su historia.*

- **CA-4.1** «Dar de baja» pide un **motivo** obligatorio y confirmación explícita.
- **CA-4.2** Una plantilla dada de baja **deja de ofrecerse** en «Generar documento» y se distingue en el
  listado (filtro de estado), pero **no se borra**.
- **CA-4.3** Los documentos ya generados con ella **siguen intactos y consultables** en el expediente.
- **CA-4.4** La baja queda auditada con motivo y actor. Si se puede reactivar o no: PA-5.

### HU-5 · Insertar un campo automático
*Como editor, quiero marcar en el texto dónde va la razón social, las naves, los KVA, etc., para que se llenen solos.*

- **CA-5.1** En el editor veo el **catálogo cerrado de campos del tipo** de la plantilla (brief §7):
  empresa, parque, naves, KVA por nave, nivel de tensión y fecha (`figura` queda fuera de v1, D14).
- **CA-5.2** Al insertar un campo se pinta **en verde** y se distingue visualmente del texto normal.
- **CA-5.3** No puedo insertar un campo que no esté en el catálogo del tipo; no existe forma de teclear uno
  inventado que el sistema reconozca como campo.
- **CA-5.4** Un campo se puede borrar o mover como una sola pieza (no queda a medias).
- **CA-5.5** Los campos solo provienen de **Inversionistas, Parques y Propiedades** (D7) más la fecha del
  sistema (D9).

### HU-6 · Escribir un dato fijo
*Como editor, quiero escribir una sola vez el apoderado, el domicilio, el destinatario, el oficio y la solicitud CFE para no repetirlos.*

- **CA-6.1** El editor ofrece capturar los **datos fijos** (apoderado, domicilio, destinatario, oficio,
  solicitud CFE) en campos propios; se pintan **en azul** dentro del texto (D8).
- **CA-6.2** Lo capturado **queda guardado en la plantilla**: al generar un documento nuevo ya vienen
  llenos, sin teclearlos otra vez.
- **CA-6.3** Cambiar un dato fijo y guardar genera **versión nueva** de la plantilla (HU-2).
- **CA-6.4** Ningún dato fijo se obtiene de la BD (D8); no se ofrece «traer el apoderado de la empresa».
- **CA-6.5** Si un dato fijo requerido está vacío, la plantilla se puede guardar pero al generar se
  **advierte** qué falta antes de poder exportar (política exacta: PA-6).

### HU-7 · Generar un documento para una empresa con varias naves
*Como quien asigna, quiero elegir una empresa y marcar sus naves para obtener un solo documento a CFE.*

- **CA-7.1** En **Parques → KVA's**, la acción «Generar documento» abre un modal con: **empresa**,
  **plantilla**, **naves de esa empresa con casilla**, **vista previa editable** y el botón
  «Generar PDF y guardar».
- **CA-7.2** La lista de empresas incluye dueños **y** arrendatarios (D12). Al elegir la empresa se listan
  **las naves que tiene como dueña o como arrendataria**, de **uno o varios parques** (D13), sin restricción
  de «un parque por documento».
- **CA-7.3** Puedo marcar **todas** o **solo algunas**; el sistema genera **un solo documento por empresa**
  con las naves marcadas (D4). Con **cero** naves marcadas el botón de generar está deshabilitado.
- **CA-7.4** La vista previa se prellena con los campos automáticos de la BD, los datos fijos de la plantilla
  y la fecha del día en formato «dd de mes de aaaa» (D9), y cambia al marcar o desmarcar naves.
- **CA-7.4b** (D10) La **cantidad de KVA por nave la captura el usuario**: viene prellenada desde la
  dotación de la nave si existe; si es 0 o no hay, el campo queda vacío para teclearla. **Nunca** se
  bloquea ni se deshabilita una nave por no tener dotación; no se puede generar con una cantidad vacía o
  no válida en una nave marcada.
- **CA-7.4c** (D11) El PDF lleva el **logo y el membrete de la plataforma** (el configurado en la BD).
- **CA-7.4d** (D13) Si las naves marcadas son de varios parques, el campo `parque` se redacta con todos los
  nombres.
- **CA-7.5** Al confirmar, el **servidor** arma el PDF sustituyendo los campos desde la BD (regla 1) y lo
  guarda en el expediente de **cada nave marcada** (D5).
- **CA-7.6** Si las cantidades capturadas son distintas entre sí, o se mezclan baja y media tensión, el texto
  generado lo **redacta correctamente** (lista por nave / agrupación por nivel, con el texto aprobado en
  PA-12) en lugar de afirmar un valor único falso (ver `04-FLUJOS` F-4).
- **CA-7.7** Si una nave marcada no pertenece a la empresa elegida (ni como dueña ni como arrendataria), el
  servidor **rechaza todo el documento** con un mensaje que nombra la nave; no se genera uno parcial
  (supuesto aprobado por Jereff).
- **CA-7.8** La generación queda auditada con el actor, la plantilla, su versión y las naves.

### HU-8 · Ajustar el texto al generar sin tocar la plantilla
*Como quien asigna, quiero corregir una frase o la fecha solo en este documento.*

- **CA-8.1** En la vista previa puedo editar el texto (incluida la **fecha**, D9, y los datos fijos, D8).
- **CA-8.2** Lo que edito se refleja en el PDF generado y se conserva como el **contenido final** del
  documento (regla 4).
- **CA-8.3** Después de generar, abro la plantilla y **no hay ningún cambio**: ni texto, ni datos fijos, ni
  versión nueva (regla 7).
- **CA-8.4** Si cierro el modal sin generar, no queda nada guardado (ni documento ni borrador).
- **CA-8.5** El texto editado al generar se trata como entrada hostil igual que el del editor: no puede
  introducir contenido fuera de lo permitido (regla 2).

### HU-9 · Ver el PDF en el expediente de la nave
*Como cualquier usuario con acceso al expediente, quiero abrir la carta que se mandó a CFE desde la propia nave.*

- **CA-9.1** Tras generar, el PDF aparece en el **expediente de cada nave marcada**, con título que
  identifica tipo y empresa, fecha y quién lo generó.
- **CA-9.2** Se abre en el visor del expediente sin salir de la nave y se puede descargar.
- **CA-9.3** Muestra qué **plantilla y versión** lo originaron (para saber de qué texto salió).
- **CA-9.4** El mismo documento está disponible desde cada una de las naves marcadas (no hay que buscar
  «el de la otra nave»).
- **CA-9.5** Un usuario sin permiso del expediente no ve ni descarga el PDF.

### HU-10 · Corregir = generar otro y dar de baja el anterior con motivo
*Como quien asigna, quiero corregir un documento que salió mal sin alterar lo ya emitido.*

- **CA-10.1** Un documento generado **no tiene botón de editar**: es inmutable (regla 4).
- **CA-10.2** Para corregir, genero un documento nuevo (HU-7) y doy de baja el anterior indicando un
  **motivo obligatorio**.
- **CA-10.3** El documento dado de baja **sigue consultable** en el expediente marcado como «de baja» con su
  motivo, quién y cuándo; no se borra el archivo (misma lógica que `kvaNaveDocs`).
- **CA-10.4** Si el documento abarca varias naves, la baja se aplica **al documento completo** y se refleja
  en el expediente de todas sus naves (a confirmar: PA-7).
- **CA-10.5** La baja queda auditada con actor del JWT, motivo y fecha.
- **CA-10.6** El orden de la corrección es **generar el nuevo primero y dar de baja el anterior después**
  (aprobado por Jereff), para que la nave nunca quede sin carta vigente. Quién puede dar de baja: ver §7
  (decisión técnica del TRD).

## 4. Alcance (v1)

**Dentro**
- Módulo **Parques → Plantillas**: listado, editor, versiones, duplicar, baja (pantallas 01 y 02).
- Tipos de lista fija `ASIGNACION_CARGA` y `DEVOLUCION` (D1). En v1 `DEVOLUCION` queda **declarada sin
  campos propios** (D14): no se construye su catálogo específico.
- PDF con logo y membrete de la plataforma (D11); cantidad de KVA capturable al generar (D10); empresa
  dueña o arrendataria y naves de varios parques en un documento (D12, D13).
- Campos automáticos del catálogo (Inversionistas, Parques, Propiedades, fecha) y datos fijos (D7, D8, D9).
- **Parques → KVA's → Generar documento** (pantalla 03): un documento por empresa, naves marcables (D4).
- Salida PDF (D6) guardada en el expediente de cada nave (D5).
- Versionado de plantillas, inmutabilidad y baja lógica con motivo del documento generado.
- Auditoría de todas las mutaciones y permisos verificados en servidor.

**Fuera de alcance** (heredado del brief §8)
- Firma electrónica · envío por correo a CFE · tipos creados por el usuario · plantillas de otros módulos ·
  Word editable · campos de fuentes distintas a D7.
- Regenerar automáticamente documentos viejos cuando cambia una plantilla.
- Generación masiva «una carta por cada empresa» en un solo paso (D4 es un documento por empresa; se repite
  la operación por empresa).
- Aprobaciones o firmas internas antes de emitir el documento.

## 5. Métricas de éxito

| Métrica | Meta propuesta | Cómo se mide |
|---|---|---|
| Tiempo para producir la carta de una empresa con varias naves | De «varios minutos de Word» a **menos de 2 minutos** | Observación con el equipo en la prueba de aceptación |
| Errores de captura en razón social / naves / KVA / nivel | **0** (todo sale de la BD) | Revisión de una muestra de documentos contra la BD |
| Cartas en el expediente de la nave | **100 %** de las generadas quedan en el expediente de cada nave marcada | Conteo documentos generados vs. entradas del expediente |
| Uso de la plantilla | Todas las cartas nuevas a CFE se emiten desde el módulo | Conteo mensual de documentos generados |
| Trazabilidad | Todo documento tiene plantilla, versión, actor y fecha | Verificación en auditoría |

*(Las metas numéricas son propuesta de Toribio para que Jereff las confirme o ajuste.)*

## 6. Riesgos de negocio

| # | Riesgo | Mitigación en el diseño |
|---|---|---|
| R1 | Se emite una carta a CFE con datos incorrectos | El servidor sustituye desde la BD; vista previa antes de generar; corregir = nuevo + baja con motivo |
| R2 | Alguien edita el machote y cambia sin querer cartas ya emitidas | Versionado + documento inmutable con contenido final guardado |
| R3 | Apoderado o domicilio desactualizados en la plantilla | Son datos fijos visibles en azul y editables al generar; se actualizan editando la plantilla (versión nueva) |
| R4 | Cantidades distintas o mezcla de tensión producen una carta engañosa | Redacción por nave / agrupada con el texto aprobado; flujos F-4 |
| R5 | La cantidad de KVA la teclea el usuario (D10) y puede equivocarse | Prellenado desde la dotación, vista previa antes de generar y corrección = nuevo + baja con motivo |
| R6 | `DEVOLUCION` pide datos fuera de las 3 fuentes de D7 | Declarada sin campos propios en v1 (D14) |
| R7 | Dos editores pisan el trabajo del otro | Aviso al guardar y versiones inmutables (F-7) |
| R8 | Contenido hostil o con formato roto en el editor | Saneo con lista permitida y catálogo cerrado de campos (regla 2) |

## 7. Decisiones cerradas posteriores al borrador

| # | Decisión | Origen |
|---|---|---|
| D10 | La cantidad de KVA la captura el usuario al generar; prellenada desde la dotación si existe; nunca se bloquea por dotación 0 | Jereff 2026-10-07 |
| D11 | El PDF lleva logo y membrete de la plataforma | Jereff |
| D12 | La empresa puede ser dueño o arrendatario; las naves elegibles son las que tiene como dueña o arrendataria (cierra PA-9) | Jereff |
| D13 | Sin restricción de parque único: naves de varios parques en un documento; el usuario decide qué y cuándo generar (cierra FL-5) | Jereff |
| D14 | `figura` sale de v1; `DEVOLUCION` declarada sin campos propios en v1 (cierra PA-1 y PA-2) | Toribio / Jereff |
| PA-10 | Empresa sin naves: aparece con aviso y no se puede generar | Jereff (confirmado con D12) |
| PA-12 | Texto de cantidades distintas y de mezcla de tensión: se usa el texto propuesto por el TRD | Jereff |
| — | Corrección: se genera primero el nuevo y después se da de baja el anterior | Jereff |
| — | Si una nave marcada no pertenece a la empresa, se rechaza todo el documento | Jereff |

## 8. Preguntas abiertas

| # | Pregunta | Dueño |
|---|---|---|
| PA-5 | ¿Una plantilla dada de baja se puede reactivar? | Jereff |
| PA-6 | Datos fijos vacíos al generar. **Propuesta: advertir y permitir** generar | Jereff (confirmar) |
| PA-7 | Baja de un documento de varias naves: ¿siempre del documento completo o también por nave? | Jereff |
| PA-11 | Nave que ya tiene un documento vigente del mismo tipo: ¿se advierte al generar otro? | Jereff |

**Decisiones técnicas que resuelve el TRD** (no requieren a Jereff): PA-3 unicidad del nombre de plantilla ·
PA-4 política de edición simultánea (mínimo en F-7) · PA-8 quién da de baja un documento · PA-13 límites de
naves por documento y versiones conservadas.
