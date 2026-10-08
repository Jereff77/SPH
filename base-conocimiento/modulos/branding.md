# Branding del ERP SPH Bienes Raíces (fuente para mockups en Pencil)

Extraído del código real el 2026-10-07.

## Logos (no están en el repo)

Los logos **viven en la base de datos y los configura el cliente desde la plataforma** (Configuración). Nunca se copian al repo ni se reconstruyen de memoria; para un mockup se consultan por MCP (SELECT).

| Qué | Dónde |
|---|---|
| Logo para fondo claro (login, contenido) | Tabla `SPHConfiguraciones`, parámetro `LOGO_FONDO_CLARO` (JSON `{ url, ancho, alto }`) |
| Logo para fondo oscuro (sidebar) | `SPHConfiguraciones`, parámetro `LOGO_FONDO_OSCURO` (JSON `{ url, ancho, alto }`); respaldo legado: `LOGO_URL` (URL simple) |
| Favicon | `SPHConfiguraciones`, parámetro `FAVICON_URL` |
| Archivos | Bucket público de Storage `branding` (`logo-claro.<ext>`, `logo-oscuro.<ext>`) |
| Código que los gestiona | `apps/api/src/modules/configuracion/configuracion.service.ts` (`obtenerLogos`, `guardarLogoArchivo`) |

| Uso | Valor |
|---|---|
| Azul principal (encabezados de tabla, botón primario, bordes de acción) | `#1f2a4d` |
| Verde acento (chips de campo automático; **no** para texto, no cumple contraste) | `#8cc63f` |
| Fondo de página | `#f9fafb` |
| Tarjetas / tablas | `#ffffff`, borde `#e5e7eb` |
| Texto / texto secundario | `#1f2937` / `#6b7280` |
| Peligro | `#dc2626` |
| Tipografía | Inter |

Patrones: botones secundarios con borde azul y texto azul; encabezado de tabla azul con texto blanco en mayúsculas; esquinas redondeadas 8–12 px.
