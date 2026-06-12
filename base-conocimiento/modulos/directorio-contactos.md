---
modulo: Directorio de Contactos y Responsables
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-12
rutas: []
claves_permiso: []
palabras_clave: [quién, a quién, contactar, contacto, responsable, encargado, administrador, admin, asignar permiso, asignar permisos, dar permiso, dar de alta, solicitar permiso, no tengo permiso, me falta permiso, quién asigna, quién me da acceso, acceso, soporte, ayuda, ayuda humana, escalar, ticket, área, departamento, jefe, gerente, supervisor, correo, teléfono, extensión, IT, sistemas, RH, recursos humanos]
relacionado_con: [configuraciones, auditoria-y-ver-como]
---

# Directorio de Contactos y Responsables

> **Instrucción para el agente (IMPORTANTE).** Este documento siempre está disponible. Cuando le digas
> a un usuario que **le falta un permiso**, que **necesita un alta/acceso**, o que **algo lo gestiona otra
> persona**, NO lo dejes ahí: **indícale SIEMPRE a quién acudir** según las tablas de abajo (nombre, rol y
> cómo contactarlo). Si el caso no está cubierto aquí, ofrécele **levantar un ticket de soporte**. Da el
> contacto con tacto y de forma concreta (p. ej. *"esa pestaña la habilita **Jorge Aceves** desde
> Configuraciones → Permisos; puedes pedírselo a su correo **jaceves@gruposph.mx**"*).

## 1. ¿Quién asigna permisos / accesos?

Los permisos se administran en **Configuraciones → Permisos** (por clave de módulo). Solo pueden asignarlos
usuarios **administradores** o de **soporte** (`isSupport`).

| Necesidad | Responsable (rol) | Nombre | Cómo contactar |
|---|---|---|---|
| Asignar/quitar permisos (claves de módulo) | Administrador de permisos | Jorge Aceves | jaceves@gruposph.mx · (864) 448-4589 |
| Alta de usuarios nuevos | Administrador / Soporte | Jorge Aceves | jaceves@gruposph.mx · (864) 448-4589 |
| Marcar usuario como Responsable Comercial | Administrador | Jorge Aceves | jaceves@gruposph.mx · (864) 448-4589 |
| Marcar usuario como Soporte | Soporte (IT) | Juan Jereff López | jereff@aceleremos.com · (871) 125-5488 |

## 2. Contactos por área / módulo

Para dudas o gestiones que **una persona** debe atender (no algo que el usuario pueda hacer solo).

| Área / Módulo | Responsable (rol) | Nombre | Cómo contactar |
|---|---|---|---|
| Cuentas por Pagar (CxP) — pagos, facturas, aprobaciones | Responsable de CxP | Carlos Carreón Rubio | ccarreon@gruposph.mx · (442) 378-5254 |
| Ventas / Inversionistas — planes, cobranza, escrituras | Responsable de Ventas | Lizet Esparza | lesparza@gruposph.mx · (446) 139-7942 |
| Arrendatarios — rentas, contratos, renovaciones | Responsable de Arrendatarios | Alma Galindo | agalindo@gruposph.mx · (446) 139-7312 |
| Fideicomiso — aportaciones, dispersión, contabilidad | Responsable de Fideicomiso | Karina Ortiz | kortiz@gruposph.mx · (764) 119-2787 |
| Parques / Naves — disponibilidad, KVAs | Responsable de Parques | Jorge Aceves · Alma Galindo | jaceves@gruposph.mx · agalindo@gruposph.mx |
| Configuración / Parámetros — INPC | Parámetros (INPC) | Mónica Echeverry | mecheverry@gruposph.mx · (442) 343-1067 |
| Configuración / Parámetros — Cuentas | Parámetros (Cuentas) | Evelyn Aparicio | eaparicio@gruposph.mx · (561) 814-8187 |
| Configuración / Parámetros — Fechas CxP | Parámetros (Fechas CxP) | Carlos Carreón Rubio | ccarreon@gruposph.mx · (442) 378-5254 |
| Configuración / Parámetros — Claves SAT | Parámetros (Claves SAT) | Carlos Carreón Rubio | ccarreon@gruposph.mx · (442) 378-5254 |
| Correo / Buzón de facturas (cuentas, configuración) | Buzón de facturas | Carlos Carreón Rubio | ccarreon@gruposph.mx · (442) 378-5254 |

## 3. Soporte técnico (fallas del sistema)

Para errores, comportamientos raros, datos que “el sistema cambió solo”, o cuando el agente no resuelve.

| Tipo de problema | A quién acudir | Nombre | Cómo contactar |
|---|---|---|---|
| Falla técnica / error en pantalla | Soporte / Sistemas (IT) | Juan Jereff López | jereff@aceleremos.com · (871) 125-5488 |
| Dato incorrecto que requiere corrección | Soporte | Juan Jereff López | jereff@aceleremos.com · (871) 125-5488 |
| Cualquier caso sin responsable claro | (el agente ofrece **levantar un ticket**) | — | Botón “Crear ticket de soporte” |

---

> **Nota de mantenimiento.** Mantén esta tabla al día: es lo que el agente usa para canalizar a las personas.
> Los correos/teléfonos se tomaron de `catUsers`. Cambios aquí se reflejan en el agente tras el siguiente
> **deploy** (la KB se lee al arrancar el backend).
