# 00 · Brief conceptual — Plantillas de documentos de KVA's

> Fuente de verdad y nomenclatura canónica del paquete. Autor: Toribio (arquitecto). Fecha: 2026-10-07.
> Estado: **DISEÑO — sin construir.** Visual aprobado por Jereff (2026-10-07): `plantillas.pen`.

## 1. Qué es (en una frase)
Un generador de documentos por plantilla dentro de **Parques**: en **Parques → Plantillas** se crean y editan
machotes; en **Parques → KVA's** se elige uno, se prellena con los datos de una empresa y sus naves, se ajusta
y se exporta a **PDF**, que queda en el expediente de cada nave.

Caso inicial: la carta «Asignación de Carga» a CFE (ejemplo del cliente: empresa EM BAJÍO EMPAQUES, naves
107-110 y 119-122, «5 KVAS en baja tensión» cada una, acometida particular).

## 2. Decisiones de Jereff (cerradas)
| # | Decisión |
|---|---|
| D1 | Varios **tipos** de plantilla; **lista fija**, solo de KVA's: `ASIGNACION_CARGA` y `DEVOLUCION`. No se crean tipos desde la pantalla. |
| D2 | Las plantillas se **crean/editan** en un módulo propio **Parques → Plantillas**. Se **asignan solo desde Parques → KVA's**. |
| D3 | Editan plantillas **ambos**: quien administra y quien asigna (permisos propios, ver §6). |
| D4 | **Un documento por empresa.** Si la empresa tiene varias naves, el usuario marca todas o solo algunas. |
| D5 | El documento generado se **guarda en el expediente de la nave** (`kvaNaveDocs`). |
| D6 | Salida: **PDF**. |
| D7 | Campos automáticos **solo de 3 fuentes**: Inversionistas, Parques y Propiedades (naves). |
| D8 | **Apoderado y domicilio no salen de la BD**: el usuario los escribe **una vez dentro de la plantilla** y quedan guardados (junto con destinatario, oficio y solicitud CFE: «datos fijos»). Se pueden ajustar al generar. |
| D9 | La **fecha** es automática (día de generación), editable. |
| D10 | **Cantidad de KVA capturada por el usuario al generar** (2026-10-07). Se prellena desde la dotación de la nave si existe; si es 0 o no hay, el usuario la teclea. Nunca se bloquea la generación por falta de dotación. |
| D11 | **El PDF lleva logo y membrete de la plataforma** (el mismo logo configurado en la BD, `configuracionApi.getLogos`). |
| D12 | **La empresa puede ser dueño o arrendatario** (cualquiera de los dos; depende de la negociación). La lista de empresas incluye ambos y las naves elegibles son las que la empresa tiene como dueña **o** arrendataria. |
| D13 | **Flexibilidad de generación:** el usuario decide qué empresa, qué naves (de uno o varios parques) y cuándo generar; el sistema solo da el machote y la herramienta. Sin restricción de «un parque por documento»: el campo `parque` se redacta con uno o varios nombres. |
| D14 | (arquitecto) El campo `figura` **sale de la v1**; `DEVOLUCION` queda en el CHECK sin campos propios; motor de PDF `pdfmake`; permisos 724/730/731. |
| D15 | **Quien tiene el permiso de generar (724) puede cambiar el texto y los datos del documento con texto libre** (Jereff, 2026-10-07; gate A-5). El contenido final queda guardado y auditado en `kvaDocGenerados`. |
| D16 | **La vista previa en PDF no deja registro**; solo el documento generado (Jereff, 2026-10-07; gate A-6). |
| D17 | **Membrete = logo de la plataforma + domicilio de Grupo SPH** (el de la carta de ejemplo: Lic. Manuel Gómez Morín, piso 11, oficina 11A, 76090, Centro Sur, Qro.; www.gruposph.mx; 442 286 7180). **El encabezado y el pie son editables** dentro de cada plantilla (y se pueden ajustar al generar). Los textos del membrete viven en la plantilla, no en la BD de configuración; solo el logo viene de la plataforma. (Jereff, 2026-10-07; cierra N-1) |
| D18 | **El logo es el de la plataforma** (`getLogos`, variante clara). Formato admitido por el PDF: PNG o JPG; con SVG/WebP el PDF sale sin imagen y la vista previa avisa. (Jereff, 2026-10-07; cierra N-2) |

## 3. Glosario canónico
- **Plantilla / machote**: documento base con texto, campos y datos fijos. Tabla `kvaPlantillas`.
- **Tipo de plantilla**: `ASIGNACION_CARGA` | `DEVOLUCION` (CHECK en BD). Define el catálogo de campos.
- **Campo automático**: marcador que el servidor sustituye con datos de la BD. Verde en el editor.
- **Dato fijo**: texto que el usuario escribe una vez en la plantilla (apoderado, destinatario, oficio,
  solicitud, domicilio). Azul en el editor. Vive en `kvaPlantillas.datosFijos`.
- **Documento generado**: PDF final, **inmutable**. Tabla `kvaDocGenerados`.
- **Empresa**: fila de la tabla `inversionista` (la misma tabla guarda inversionistas y arrendatarios, con
  banderas `inversionista` / `arrendatario`). Su nombre en el documento es `razonsocial`.

## 4. Hechos verificados en la BD real (2026-10-07, proyecto `szjlkvakwljssdnysazp`)
- `inversionista` (singular): 409 activas = 174 inversionistas, 101 arrendatarios, 4 ambas; **0 sin `razonsocial`**.
- `propiedades` (idPropiedad, **idInversionista**, idNave, idParque, status, motivoBaja): une nave ↔ dueño.
- `arrenPropiedades` (idNavArrend, **idArrendador**, idNave, idParque, status): une nave ↔ arrendatario.
- `kvasAsignados` activos: 85 (RENTA BT 2 · VENTA BT 75 · VENTA MT 8), todas `etapa=ASIGNADO`.
  ⚠️ **Las 85 tienen `idPropiedad` e `idNavArrend` NULOS**: la asignación **no** apunta a la empresa; la
  empresa se obtiene **por la nave** (`propiedades.idNave` / `arrenPropiedades.idNave`). El TRD debe definir
  la regla exacta (dueño vs. arrendatario según `figura`).
- `naves`: `dotacionMt` / `dotacionBt` (el «paquete» reservado por nave), `numNaveNAME`, `idParque`.
- `parques`: `nomParque`, `direccion`.
- `kvaNaveDocs` (expediente por nave): idDoc, idNave, idParque, titulo, descripcion, urldoc, status,
  motivoBaja, uidr, fc. Permiso para subir: **723**.
- No existe tabla de plantillas de documentos (`segPlantillasPermisos` es de otra cosa: plantillas de permisos).

## 5. Reglas inviolables del diseño
1. **El servidor arma el PDF y sustituye los campos desde la BD.** Nunca con datos que mande el cliente.
2. El HTML/JSON del editor es **entrada hostil**: se valida con esquema (Zod) y se **sanea con lista
   permitida** de nodos y marcas; los campos solo pueden ser claves del **catálogo cerrado del tipo**.
3. Toda mutación audita con el **actor del JWT** (`fn_auditoria`); permisos verificados en servidor.
4. El **documento generado es inmutable**. Corregir = generar otro; el anterior se da de **baja lógica con
   motivo** (como `kvaNaveDocs`). Se guarda la **versión de plantilla** y el **contenido final** usados.
5. La plantilla se **versiona** (cada guardado = versión nueva, las anteriores no se editan) para que un
   documento viejo siempre sepa de qué texto salió.
6. Al generar, el servidor **valida que cada nave pertenece a la empresa elegida** y está en el parque
   correcto; una nave sin KVA asignados/dotados no es seleccionable.
7. El ajuste de texto al generar **no modifica la plantilla**.
8. Escalabilidad: índices en las FK nuevas, RLS a costo constante, PDF **sin bloquear** el hilo (sin
   trabajo pesado dentro de la petición si el motor lo exige — el TRD lo resuelve y documenta).
9. Respeta los patrones del módulo KVA's: `KvasService`, `archivo-seguro.ts` (magic bytes, bucket),
   permisos numéricos 720-723, `fn_auditoria`, UI con componentes compartidos (modales en portal, fechas
   dd/mm/aaaa, scroll sin barra).

## 6. Permisos (a confirmar en el TRD contra la numeración real)
- **Plantillas · ver** y **Plantillas · editar** (claves nuevas, sin colisión con 720-723).
- **Usar plantilla al asignar**: lo cubre un permiso de KVA's (propuesta: reusar **721** asignar + **723**
  documentos, o una clave nueva «generar documento»; el TRD decide y justifica).
- Soporte de la plataforma ve y opera todo (regla global), con trazabilidad a su nombre.

## 7. Catálogo de campos (lista fija por tipo — a cerrar en el TRD)
| Fuente | Campo | Tipo ASIGNACION_CARGA | Tipo DEVOLUCION |
|---|---|---|---|
| Inversionistas | `empresa` (razonsocial) | ✅ | ✅ |
| Parques | `parque` (nomParque) | ✅ | ✅ |
| Propiedades | `naves` (números, agrupa rangos) | ✅ | ✅ |
| Propiedades | `kvas_por_nave` (redacta: «5 KVAS» si iguales; lista por nave si difieren) | ✅ | ✅ |
| Propiedades | `nivel` («baja tensión» / «media tensión»; agrupa si hay mezcla) | ✅ | ✅ |
| Propiedades | `figura` (venta / renta) | ✅ | ✅ |
| Sistema | `fecha` (dd de mes de aaaa) | ✅ | ✅ |
| Devolución | `kvas_devueltos`, `folio_devolucion`, `fecha_devolucion` (de `kvaDevoluciones`) | ❌ | ✅ (a confirmar: ¿entra en la fuente «Propiedades»? es una extensión de D7 que Jereff debe aprobar) |

⚠️ **Pregunta abierta para Jereff (no bloquea el resto):** el tipo `DEVOLUCION` necesita datos de
`kvaDevoluciones`, que no es ninguna de las 3 fuentes de D7. Propuesta: en v1 solo se construye
`ASIGNACION_CARGA`; `DEVOLUCION` queda declarado en el CHECK pero sin campos propios hasta que Jereff
amplíe D7.

## 8. Fuera de alcance (v1)
Firma electrónica · envío por correo a CFE · tipos creados por el usuario · plantillas de otros módulos ·
Word editable · campos de fuentes distintas a D7.

## 9. Visual
`plantillas.pen` (3 pantallas): `01 Plantillas — listado` · `02 Plantillas — editor` ·
`03 KVA's — generar documento al asignar`. Marca real: azul `#1f2a4d`, verde `#8cc63f`.
Pendiente: crear `modulos/branding.md` del proyecto (regla global; hoy no existe) con colores vigentes y
dónde vive el logo (BD, vía `configuracionApi.getLogos`).
