# Conocimiento Arquitectónico del Sistema SPH

## REGLA OBLIGATORIA: Cargar Conocimiento del Sistema

**AL INICIO DE CADA SESIÓN**, antes de responder cualquier pregunta o realizar cualquier tarea relacionada con la base de datos o el sistema SPH, DEBES:

1. Invocar el skill `sph-knowledge` usando el Skill tool:
   ```
   Skill({ skill: "sph-knowledge" })
   ```

2. Aplicar todo el conocimiento contenido en ese skill durante la sesión.

## Por qué es obligatorio

El sistema SPH tiene convenciones y decisiones arquitectónicas **contraintuitivas** que, si se desconocen, llevan a análisis incorrectos y diagnósticos erróneos. Ejemplos críticos:

- `arrenPropiedades.idArrendador` = INQUILINO (no arrendador — nomenclatura engañosa)
- `pdp.pdpactivo` está DEPRECADO y congelado en `false` — no usarlo como fuente de verdad
- `pdpDetalle.pago_monto` y `validado_monto` son columnas LEGACY — no usarlas
- La fuente de verdad de pagos es la tabla `pagos`, no `pdpDetalle`
- `propiedades.tienenPdp` controla si el frontend muestra el plan de pagos
- `numNaveNAME` no siempre es numérico (existen naves "GYM", "COWORKING", "A", "B", "C")

Ignorar estas reglas resulta en:
- Análisis financieros incorrectos
- Inconsistencias falsas reportadas al usuario
- Queries que fallan por cast inválido a INTEGER
- Confusión entre dueño e inquilino de una nave

## Referencia rápida

El skill completo está en:
`.claude/skills/sph-knowledge/SKILL.md`
