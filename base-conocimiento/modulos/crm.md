---
modulo: CRM
estado: stub
version_doc: 0.1
ultima_actualizacion: 2026-06-04
rutas: []
claves_permiso: []
tablas: [crm_leads, crm_Agenda, crm_tipoActividad, empresas, leads_poraprobar]
palabras_clave: [CRM, lead, prospecto, oportunidad, empresa, inmobiliaria, asesor, etapa, embudo, actividad comercial, agenda, "no encuentro un lead", "cómo doy de alta un prospecto", "leads por aprobar", "similitud de leads", "duplicado", "no veo CRM en el menú", "cómo cambio de etapa"]
relacionado_con: [configuraciones]
---

# Módulo: CRM  — (STUB, pendiente en v2)

> ⚠️ **Estado: NO desarrollado en v2.** Existe en v1. Ficha mínima; derivar a soporte para operaciones.

## Qué hace (en v1)
Gestión comercial: **leads/prospectos**, etapas del embudo, empresas e inmobiliarias, asesores, agenda y
actividades comerciales; detección de leads similares y migración de "por aprobar" a leads.

## Entidades y tablas principales
- `crm_leads`, `leads_poraprobar`, `empresas`, `crm_tipoActividad`, vista `crm_Agenda`.
- Muchas funciones `crm_*` y `leads_*` (cambio de etapa, similitud, reportes por correo).

## Notas para la migración
- Usa búsqueda por similitud (extensión `pg_trgm`/`fuzzystrmatch`) para detectar leads duplicados.
- Hay integraciones por correo / posibles flujos n8n (vistas `n8n_*`): confirmar antes de tocar objetos.

## Para el agente de soporte
Explicar a alto nivel; para operaciones de CRM, **levantar ticket** o remitir a v1 mientras no se migre.
