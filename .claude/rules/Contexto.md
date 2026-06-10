# Contexto.md

### Communication Language

**ALWAYS communicate in Spanish** unless the user explicitly requests another language. All documentation, responses, and error messages should be in Spanish by default.

## Session Documentation Requirements

### MANDATORY: Context File Management

**CRITICAL INSTRUCTION FOR ALL AIs**: Before starting any work on this project, you MUST:

1. **Check for existence** of `.sessions/contexto.md` file
2. **If the file doesn't exist**: Create it immediately using the template below
3. **If the file exists**: Read it completely to understand previous work
4. **Always update** the file after completing any significant work

### Creating the Context File

If `.sessions/contexto.md` doesn't exist, create the directory and file with this structure:

```markdown
# Contexto del Proyecto - SPH Bines Raices Sistema de Incidentes

## Información de Sesión
- **IA Utilizada**: [Tu modelo/nombre (ej: Claude Sonnet 4, Qwen, GPT-4, etc.)]
- **Fecha**: [YYYY-MM-DD]
- **Hora**: [HH:MM:SS]
- **Herramientas**: [Claude Code CLI, Cursor, VS Code, etc.]
- **Agentes Especializados Utilizados**: [Lista de agentes o "Ninguno"]
- **Rol**: Orquestador IA

## Historial de Trabajo por IA
[Aquí cada IA debe agregar su sección]
```

### Session Documentation Protocol

For each work session, add an entry following this format:

```markdown
### [IA Name] ([Model Version]) - Sesión [Date]

#### Rol: Orquestador IA
- **Solicitud del usuario**: [Descripción de lo que pidió el usuario]
- **Análisis realizado**: [Cómo analizaste la solicitud]
- **Decisión de agentes**: [Por qué elegiste ciertos agentes o trabajaste directamente]

#### Tareas Realizadas:
1. **[Task Description]** (Herramientas: [tools used])
   - Detalles específicos de lo realizado
   - Archivos modificados/creados
   - Agente utilizado (si aplica)

#### Agentes Especializados Utilizados:
- **[Agent Name]**: [Purpose and what it did]
- **Decisión directa**: [Si no usaste agentes, explicar por qué]

#### Errores Encontrados y Soluciones:
- **Problema**: [Descripción detallada del error]
- **Solución por [AI Name]**: [Cómo se resolvió]
- **Herramientas usadas**: [Lista de herramientas]
- **Archivos afectados**: [Lista de archivos]
- **Agente responsable**: [Qué agente manejó la solución]

#### Archivos Modificados/Creados:
- `archivo1.js`: [Descripción de cambios]
- `archivo2.py`: [Descripción de cambios]
```
