---
documento: Plan — Agente de Soporte "razonador" (retirar enlatados, protocolo de razonamiento, perfil completo, Sonnet 5)
estado: EN CONSTRUCCIÓN — Fase 1 ✅ (reversión + grant) + Fase 2 ✅ (código: perfil, protocolo, sin enlatados) + Fase 4 ✅ código (edge sin `temperature`) + Fase 3 KB reglas de negocio ✅ (Nicanor) + Validación seguridad Opus 4.8 ✅ (sin ALTA; M2/B3 mitigados en código; M1 política de catUsers ✅ aplicada `uid=auth.uid()` y verificada: usuario normal solo ve su fila, admins con clave 201 ven todos por su permiso legítimo). Typecheck verde. FALTA: pasos de UI de Clientes (agente de Clientes) → luego cierre coordinado único (deploy edge + push api + config BD Sonnet 5/prompt + M1 + documenta todo), SIN desplegar hasta que Clientes también esté listo. (2026-07-03)
version_doc: 1.0
ultima_actualizacion: 2026-07-03
autor: Toribio (Opus 4.8) — Orquestador IA
palabras_clave: [agente, soporte, IA, razonamiento, text-to-SQL, consultar_datos, enlatados, escalar,
  guiar, canalizar, perfil, isSupport, v2_soporte_ro, Sonnet 5, OpenRouter, edge, soporte-chat, 502]
relacionado_con: [soporte-ia, clientes, arrendatarios, inversionistas, directorio-contactos, configuraciones]
supersede: PLAN-agente-soporte-guiar-cliente-sin-tipo.md
---

# Plan — Agente de Soporte "razonador": que RESUELVA, no que escale

> ⛔ **GATE DE DISEÑO.** Documento = **entrada cerrada** para el ejecutor. **Prohibido** escribir/editar
> código, mutar BD, migrar o desplegar **hasta que Jereff apruebe** este plan. La construcción es una fase
> posterior y separada. Los cambios de riesgo (BD, prompt/RBAC, edge, varios archivos) cierran con
> **validador de seguridad Opus 4.8**.

---

## 1. Motivo (dolor real, confirmado por Jereff)

El agente **cumple su función básica pero se queda corto**: da respuestas casi siempre correctas, pero
ante cualquier fricción **deriva/escala** — casi siempre hacia **Jorge Aceves** (quien asigna permisos) —
en vez de **resolver**. Caso real (Jessamyn/NEXGEN, 2026-07-03): identificó que el inquilino "no está
marcado como arrendatario" y, en lugar de guiar la solución, levantó un ticket. Además, en pruebas locales
le pidió a **Jereff (usuario root/soporte)** el permiso 300, que él ya tiene por ser soporte.

**Consecuencia:** el agente le representa **más trabajo** a Jereff (resolver el ticket falso **+** arreglar
al agente). Un agente que solo escala es **peor que no tenerlo**: mata su propósito (descargar al soporte
humano) y la adopción.

## 2. Objetivo

Reencuadrar el agente de **"clasificador que escala"** a **"solucionador de primer nivel que razona"**:
consulta el estado real (solo lectura, ya seguro), lo cruza con las reglas de negocio (KB), **guía** al
usuario a resolverlo él mismo, y **escala solo lo que de verdad lo amerita**. Es replicar el **método** de
trabajo (verificar → diagnosticar causa vs síntoma → resolver con pasos → escalar como último recurso), no
"clonar" un modelo.

## 3. Decisiones tomadas por Jereff (cerradas)

- **(a) Retirar TODOS los enlatados** de diagnóstico (`buscar_cliente`, `por_que_no_aparece_en_planes`,
  `por_que_no_aparece_en_arrendatarios`, `diagnosticar_nave`). El agente razona con `consultar_datos`
  (text-to-SQL acotado, ya existente y seguro) + la KB.
- **(b) Modelo:** **Sonnet 5** en OpenRouter; **fallback Sonnet 4.6** si el 5 no está en el catálogo de
  OpenRouter.
- **(c) Otro Toribio:** ya implementó (le faltó documentar+push). **Eliminar sus cambios** (reversión
  quirúrgica) — su enfoque (más enlatados) es opuesto a este rediseño.
- **(d) Bug de root:** Jereff **siempre usa `Juanjereff`** (isSupport=true); `jereff77` (no soporte) solo lo
  usó una vez al inicio. → El fallo NO fue "probó con el usuario equivocado": es un **bug real de lectura de
  perfil** (ver §4).

## 4. Causa raíz del bug de "no supo que es root" (VERIFICADA en prod)

- **Dos usuarios Jereff:** `Juanjereff Lopez` (jereff@aceleremos.com, `idPerfil=1`, **`isSupport=true`**) —
  el que usa siempre — y `Jereff Lopez` (jereff77@gmail.com, `isSupport=false`) — descartado por Jereff.
- **`catUsers` tiene RLS activado** y existe la **política** `v2_soporte_ro_select` para el rol
  `v2_soporte_ro` (SELECT). **PERO el rol `v2_soporte_ro` NO tiene el `GRANT SELECT` sobre `catUsers`**
  (solo lo tiene sobre `segModulos` y `segModulosUsuarios`). En Postgres se requieren **ambos** (grant de
  tabla **y** política RLS); sin el grant, la lectura falla con *permission denied*.
- **Efecto:** `SoporteService.perfilUsuario()` lee `catUsers` con `v2_soporte_ro` → **falla** → el `catch`
  loguea y deja **`esSoporte=false`** y **`nombre='usuario'`**. Los **permisos** (claves) sí se leen
  (`segModulosUsuarios` sí tiene grant+política), por eso el agente conoce las claves pero **no** el rol
  soporte ni el nombre. → Con Juanjereff (root) el agente cree que no es soporte y pide el permiso 300.
- **Fix:** `GRANT SELECT ON "catUsers" TO v2_soporte_ro;` (aditivo; la política ya existe). Cambio de BD →
  requiere **autorización explícita de Jereff** (regla 1).

## 5. Alcance — piezas (0 → F)

### Pieza 0 — Reversión quirúrgica del trabajo a medias del otro Toribio
Revertir **SOLO** estos 4 archivos modificados (sin commitear) al estado de `HEAD` (`git restore <path>`),
**sin** `git checkout .` masivo (hay cambios ajenos `??` que NO se tocan: `.claude/`, `CLAUDE.md`, scripts
`dump-comprobante.mjs`/`test-parser-banbajio.mjs`, `PLAN-reporte-presupuesto-cxp.md`, migración CxP
`2026-06-17-...`):
- `apps/api/src/modules/soporte/diagnostico.service.ts`
- `apps/api/src/modules/soporte/soporte.service.ts`
- `base-conocimiento/modulos/clientes.md`
- `base-conocimiento/modulos/soporte-ia.md`

El plan del otro Toribio `PLAN-agente-soporte-guiar-cliente-sin-tipo.md` (archivo `??`, sin trackear): antes
de borrarlo, **rescatar como semilla de la KB** sus condiciones YA VERIFICADAS de los selectores
(arrendatarios `(arrendatario OR usuarioFinal) AND status=true`; papelera = sin tipo). Luego borrarlo o
marcarlo `supersede` por este plan.

> ⚠️ Confirmar con `git status`/`git diff` que esos 4 son exactamente los cambios del otro Toribio antes de
> revertir. La reversión va **antes** de aplicar el rediseño (base limpia).

### Pieza A — Fix del bug de perfil (BD + verificación)
- **BD (autorizada por este plan; aplicar con OK de Jereff):** `GRANT SELECT ON "catUsers" TO v2_soporte_ro;`
  Migración `base-conocimiento/migraciones/2026-07-03-soporte-ro-grant-catusers.sql` (reversible:
  `REVOKE SELECT ON "catUsers" FROM v2_soporte_ro;`).
- **Endurecer el fallo:** `perfilUsuario()` ya loguea el error (no lo silencia). Añadir que, si la lectura de
  `catUsers` falla, el system prompt lo indique explícitamente ("⚠️ no se pudo verificar el rol") en vez de
  asumir `no-soporte` — para que un fallo futuro sea visible, no silencioso.
- **Verificar** tras el grant: `perfilUsuario('896f01e5-…-db30')` (Juanjereff) devuelve `esSoporte=true` y su
  nombre real.

### Pieza B — Perfil COMPLETO del usuario en el prompt (primer insumo)
- Ampliar `perfilUsuario()` para incluir **correo** (`catUsers.email`) además de nombre/rol/claves.
- En `construirSystemPrompt`, inyectar de forma **prominente y al inicio** el bloque "QUIÉN PREGUNTA":
  **nombre, correo, si es soporte/root (acceso total), y la lista de permisos** — y una regla dura:
  *"ANTES de decidir nada, mira quién pregunta y a qué tiene acceso."*

### Pieza C — Reescritura del system prompt: PROTOCOLO DE RAZONAMIENTO (el corazón)
**Archivo:** `apps/api/src/modules/soporte/soporte.service.ts` → `construirSystemPrompt()` +
`DEFAULT_PROMPT` (y actualizar el `SOPORTE_IA_PROMPT` de `SPHConfiguraciones` si se usa como base).

1. **Sembrar el protocolo de 7 pasos** (razonar antes de responder):
   1. Entiende el problema real (no el síntoma literal).
   2. **No asumas — verifica.** Si la causa depende de un dato (¿existe?, ¿tiene el tipo?, ¿está activo?),
      **consúltalo con `consultar_datos`** antes de responder. Nunca inventes la causa.
   3. Formula una hipótesis y contrástala con lo que devuelve la consulta.
   4. **Clasifica:** ¿*datos/config* (el usuario lo corrige en la app) o *sistema* (bug/plataforma)?
   5. **RESUELVE — no solo diagnostiques.** Da los **pasos exactos** y accionables en la app (módulo,
      pantalla, botón, casilla), diciendo **dónde** encontrar el registro.
   6. **Escalar es el ÚLTIMO recurso.** Solo si: (a) al usuario le **falta un permiso** que necesita →
      dile qué clave y canalízalo con quien la asigna (Jorge Aceves), **sin** ticket; o (b) requiere
      **cambio de plataforma o de datos que nadie corrige desde la UI** → ticket **planteado como
      "requiere revisión de Jereff"** (⛔ el agente **no** afirma "hay que tocar la BD"; solo lo señala).
   7. **Sé honesto:** si no puedes verificar algo, dilo; no inventes.
2. **Eliminar/reformular las reglas contradictorias del prompt actual** (las que empujan a escalar):
   - La regla "**siempre** que menciones que algo lo gestiona otra persona, canaliza" → canaliza **solo**
     cuando aplique (falta de permiso real, o duda de negocio del responsable de área), no por defecto.
   - La regla que lista "**un dato incorrecto**" como motivo de **ticket** → un dato mal configurado se
     **GUÍA** (corregible en la app). Ticket solo para falla de sistema/plataforma.
   - Conservar y reforzar: "PRIMERO GUIAR, LUEGO CANALIZAR: revisa los PERMISOS del usuario; si tiene la
     clave del módulo donde se corrige, guíalo para que lo haga él mismo; ⛔ marcar/quitar el TIPO de un
     cliente es corrección de DATOS (clave 300), NUNCA lo derives al admin de permisos por esto."
3. **Ampliar el uso de `consultar_datos` a DIAGNÓSTICO** (hoy el prompt lo encuadra solo en "preguntas
   analíticas"): autorizar explícitamente consultarlo para **ver el estado de un registro** ("¿este cliente
   tiene el flag arrendatario / está activo / es prueba?") y cruzarlo con las reglas de la KB.

### Pieza D — Retirar TODOS los enlatados
- **`diagnostico.service.ts`:** ✅ **DECIDIDO (Jereff, 2026-07-03) — eliminar el archivo por completo** y su
  provisión en `soporte.module.ts` (quitar las 4 herramientas, el import y la inyección).
- **`soporte.service.ts`:** en el tool-loop (`enviar`), quitar `...this.diagnostico.toolSpecs()` del array
  `tools` y el branch `this.diagnostico.ejecutar(...)`; el loop queda **solo** con
  `consultas.toolSpecs()` + `consultas.ejecutar()` (`consultar_datos` + `describir_tablas`). Quitar el
  import y la inyección de `DiagnosticoService` (constructor + módulo).
- Revisar que no queden referencias colgantes (typecheck en verde).

### Pieza E — Enriquecer la KB con reglas de negocio de diagnóstico
El agente ya no trae las reglas "enlatadas" en código: deben vivir en la KB (el agente **solo sabe lo que
está en la KB**). Documentar en prosa las **reglas de "por qué no aparece X"** de cada listado clave
(migrando lo que estaba en los enlatados, ya verificado):

> ⚠️ **COORDINACIÓN (2026-07-03):** otra sesión está **rediseñando el front de Clientes** (+ ajuste de la
> tabla). Los **pasos de UI** que documentemos aquí (chip Papelera, botón Editar, casillas de tipo) deben
> reflejar el **front resultante**, no el actual → documentar la parte de *pasos de UI de Clientes*
> **después** de que ese rediseño esté estable, o verificarla contra el front final. Las **reglas de datos**
> (condiciones de los selectores, "sin tipo → Papelera") NO dependen del front y pueden documentarse ya.
- `modulos/clientes.md`: **sin tipo → Papelera**; cómo sacarlo (Clientes → chip Papelera / buscar por
  RFC/razón social → ✏️ Editar → marcar el tipo → Guardar; requiere clave 300; RFC obligatorio no genérico).
- `modulos/arrendatarios.md`: selector de Arrendatarios = **`(arrendatario=true OR usuarioFinal=true) AND
  status=true`**; nave disponible para rentar = `Arrendada=false AND status=true`.
- `modulos/inversionistas.md`: selector de Planes (Ventas) = **`inversionista=true, pruebas=false,
  status=true`**; nave disponible para vender = `situacion='Disponible'`.
- `modulos/soporte-ia.md` **§10:** reescribir — el agente **ya no usa herramientas enlatadas**; diagnostica
  **razonando** con `consultar_datos` (estado real) + KB (reglas) + protocolo del prompt. Documentar el
  criterio guiar→canalizar→escalar y el nuevo umbral de escalación (solo plataforma/BD).
- Verificar que el **router de la KB** (`KbService`) inyecte estos documentos ante síntomas "no aparece / no
  me deja" (revisar `palabras_clave` del frontmatter).

### Pieza F — Modelo (Sonnet 5) + arreglar el 502 de la edge
- **Edge `soporte-chat`:** **quitar `temperature`** (y cualquier `top_p`/`top_k`/`budget_tokens`) del cuerpo
  que envía a OpenRouter — la familia Sonnet 5 los **rechaza con 400** (misma raíz del 502 con haiku;
  alinear con `ia-chat`). Reconfirmar contra el código real de la edge antes de tocar.
- **`SOPORTE_IA_MODELO`** (`SPHConfiguraciones`): ✅ **VERIFICADO en OpenRouter (2026-07-03) — usar
  `anthropic/claude-sonnet-5`** (slug canónico `anthropic/claude-sonnet-5-20260630`; **soporta tools/
  function-calling**, requisito del tool-loop). Fallback a 4.6 **descartado** (Sonnet 5 sí está disponible).
  El cambio es dato en BD (sin redeploy).
- **Desplegar la edge aparte** (`supabase functions deploy soporte-chat`) — NO va en el push de api/web.
- Considerar `effort`/adaptive thinking del modelo nuevo para calibrar costo/latencia (afinable tras probar).

## 6. Lo que NO se toca (límites del ejecutor)
- ❌ **Capa de seguridad de datos** (`consultas.service.ts`, rol `v2_agente_ro`, RPC `agente_consulta_sql`):
  intacta — solo nos **apoyamos más** en ella. El **parser textual** `tablasFueraDeUniverso` es deuda
  conocida (aislamiento inter-módulo best-effort); **NO** se resuelve aquí y **NO** se empeora. La barrera
  dura (lista blanca del rol) ya protege lo sensible (verificado).
- ❌ **Frontend del widget** y el flujo de **tickets/escalación** (`escalar`, `proponerTicket`,
  `soporte-admin.*`): se conservan; solo cambia **cuándo** el agente ofrece escalar (vía prompt).
- ❌ **Ningún otro módulo ni los archivos `??` ajenos** del working tree.
- ❌ No cambiar la definición de "Papelera" ni la lógica de tipos de cliente (apunte de producto separado).

## 7. Checklist de seguridad (gate de diseño)
- 🛡️ **Frontera de confianza:** intacta. Todo en `apps/api`/edge; el front no cambia; sin secretos nuevos.
- 🔑 **Auth/identidad:** el perfil (incl. rol soporte) sale de lecturas server-side atadas al **JWT**
  (`v2_soporte_ro`), nunca del body. El grant a `catUsers` es SELECT de un conjunto que el usuario ya puede
  ver (RBAC del proyecto). Verificar que el grant no exponga columnas sensibles de más (revisar columnas de
  `catUsers`; el perfil solo usa nombre/email/isSupport — considerar una **vista mínima** si hay PII de
  terceros, aunque el rol lee el registro por `uid` del propio usuario).
- 🔒 **RLS / aislamiento:** el grant a `v2_soporte_ro` respeta la política existente `v2_soporte_ro_select`.
  El text-to-SQL sigue acotado por claves + rol RO (sin cambios).
- ✅ **Validación de entrada:** `consultar_datos` mantiene su doble barrera (SELECT + universo + rol). No se
  introduce SQL en string nuevo.
- 🧾 **Trazabilidad:** sin mutaciones nuevas del agente. La conversación se sigue auditando (`comoActor`); el
  razonamiento queda en `debug_meta.traza` (útil para calibrar el nuevo comportamiento).
- ♻️ **Reutilización / impacto:** se **elimina** duplicación (los enlatados). Consumidor único del tool-loop:
  el propio agente. El cambio de **prompt** es global → verificar que la canalización legítima (usuario **sí**
  sin permiso) siga funcionando (pruebas §8).

## 8. Criterios de aceptación y pruebas
1. **Build/typecheck/lint** verdes en `apps/api` (y `apps/web` si se tocara — no debería).
2. **Bug de root cerrado:** con **Juanjereff** (root), preguntar "¿tengo el permiso 300?" → el agente
   responde **directamente que sí** (es soporte / acceso total), **sin** derivar a Jorge.
3. **Caso NEXGEN (guiar, no escalar):** usuario con clave 300 pregunta "no me aparece Nexgen en
   arrendatarios" → el agente (a) **consulta** el estado real, (b) identifica "sin tipo → Papelera", (c) da
   los **pasos exactos** (Clientes → Papelera → Editar → marcar Arrendatario → Guardar), (d) **no** deriva a
   Jorge, (e) **no** fuerza ticket.
4. **Escalación correcta:** un caso que **sí** requiere plataforma/BD → el agente escala planteándolo como
   "requiere revisión de Jereff", con diagnóstico claro; y un usuario que **sí** carece del permiso → lo
   canaliza con quien lo asigna (no ticket). (No-regresión de canalización legítima.)
5. **Sin enlatados:** confirmar que el modelo solo dispone de `consultar_datos`/`describir_tablas` y que no
   quedan referencias a `DiagnosticoService`.
6. **Modelo/edge:** con Sonnet 5 (o 4.6) la edge responde **sin 502/400** (temperature removida); el agente
   completa un tool-loop de diagnóstico real end-to-end.
7. **Solo lectura:** confirmar que ninguna ruta del agente ejecuta escrituras (el rol RO lo impide).

## 9. Riesgo, verificación y cierre
- **Nivel de riesgo:** **ALTO-MEDIO.** Toca comportamiento del agente (prompt/RBAC), retiro de herramientas,
  **BD** (grant), **modelo** y **edge**; varios archivos. → Cierre con **validador de seguridad Opus 4.8**
  (revisión adversarial: perfil/JWT, grant mínimo, solo-lectura, prompt no filtra internals, canalización
  legítima) **+ verificación del orquestador** (Toribio). Si hay hallazgo alto → se corrige y se re-valida.
- **Verificación de comportamiento:** usar la auditoría de conversaciones (Configuraciones → Soporte →
  Razonamiento) para revisar trazas reales tras el cambio y calibrar.
- **Despliegue:** el push a `erp_v2` redespliega **api+web** automático; la **edge** se despliega **aparte**;
  el **grant** y `SOPORTE_IA_MODELO` son cambios en BD (con OK de Jereff / atómico del cierre).
  ⚠️ **Commit SELECTIVO**: incluir **solo** los archivos de este plan (backend `soporte/*`, KB, migración,
  edge). **NO** arrastrar el rediseño del **front de Clientes** de la otra sesión (`apps/web/.../clientes/`).
  Verificar con `git status`/`git diff` antes de commitear.
- **Cierre «documenta todo»:** KB (`clientes.md`, `arrendatarios.md`, `inversionistas.md`, `soporte-ia.md`) +
  `migraciones/2026-07-03-soporte-ro-grant-catusers.sql` + versión en `v2_changelog` + `APP_VERSION_RAW`
  (MINOR) + entrada en `.sessions/bitacora.md` + commit `vN.N.N:` a `erp_v2`.

## 10. Orquestación (asignación sugerida)
| Fase | Pieza | Ejecutor | Nota |
|---|---|---|---|
| 1 (base) | 0 reversión | **Toribio (directo)** | git restore quirúrgico de 4 archivos; NO masivo |
| 1 (base) | A grant BD | **Toribio** + OK de Jereff | `apply_migration` sensible (auth) |
| 2 (núcleo) | C prompt + B perfil | **Toribio (directo)** | corazón del rediseño, muy acoplado |
| 2 (núcleo) | D retirar enlatados | **Nicanor (Sonnet)** | mecánico; cuidar imports/módulo/typecheck |
| 3 | E KB | **Nicanor** o directo | prosa; migrar reglas verificadas |
| 4 | F modelo + edge | **Toribio** | verificar OpenRouter + editar edge + deploy edge |
| 5 (cierre) | validación | **Validador Opus 4.8** + Toribio | adversarial; luego «documenta todo» |

**Orden recomendado:** Fase 1 → 2 → 3 → 4 → 5. (C+B+D juntas: el prompt nuevo asume "sin enlatados" y
"perfil completo".)

## 11. Decisiones cerradas (Jereff, 2026-07-03)
1. ✅ **`diagnostico.service.ts`: eliminar el archivo por completo** (+ su provisión en `soporte.module.ts`).
2. ✅ **`catUsers`: `GRANT SELECT` sobre la tabla** para `v2_soporte_ro` (la política RLS ya acota; el perfil
   lee el registro del propio usuario). Sin vista intermedia.
3. ✅ **Modelo: Toribio verifica el catálogo de OpenRouter**, fija Sonnet 5 y cae a Sonnet 4.6 si no está.

**Pendiente único:** visto bueno EXPLÍCITO de Jereff para pasar de DISEÑO a CONSTRUCCIÓN (gate).
