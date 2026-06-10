# Guía de Documentación Estándar - Proyecto supaSPH-QR

Esta guía establece los estándares y convenciones para documentar todos los componentes que modifiquen la base de datos en el proyecto supaSPH-QR.

## 📁 Estructura de Carpetas

### Organización Principal
```
nombre_tabla/
├── tabla_nombre_tabla.sql     # Definición de la tabla
├── funciones y trigger/        # Funciones y triggers asociados
└── vistas/                     # Vistas asociadas (si existen)
```

### Ubicación por Tipo de Componente

#### Tablas
- **Ubicación**: Raíz de la carpeta de la tabla
- **Nomenclatura**: `tabla_nombre_tabla.sql`

#### Funciones
- **Funciones de tabla**: `nombre_tabla/funciones y trigger/`
- **Funciones generales**: `funciones generales/`
- **Funciones de validación**: Misma carpeta que la tabla principal
- **Funciones de vistas**: Misma carpeta que la tabla principal

#### Triggers
- **Siempre**: En la carpeta de la tabla donde se activan
- **Nomenclatura**: `trigger_nombre_tabla_accion.sql`

#### Vistas
- **Siempre**: En subcarpeta `vistas/` dentro de la tabla principal
- **Nomenclatura**: `v_nombrevista.sql`

## 📝 Estándar de Documentación

### Encabezado Obligatorio
Todos los archivos SQL deben incluir:

```sql
--[Fecha y Hora]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Descripción clara y concisa del componente
--
--[Parámetros] (si aplica):
--   - nombre_parametro (tipo): Descripción del parámetro
--
--[Salida] (si aplica):
--   - tipo: Descripción del valor de retorno
--
--[Uso típico]: Descripción de cuándo y cómo se utiliza
--[Ejemplo]: Ejemplo de uso o llamada
--
--[Relaciones]: 
--   - Tablas relacionadas
--   - Funciones/triggers asociados
--
--[Validaciones] (si aplica):
--   - Validaciones realizadas
--   - Condiciones especiales
```

### Contenido Específico por Tipo

#### Tablas
1. **Descripción completa** del propósito de la tabla
2. **Campos principales** con tipos de datos y restricciones
3. **Claves primarias** y su propósito
4. **Claves foráneas** y relaciones con otras tablas
5. **Índices** creados y su justificación
6. **Restricciones** (CHECK, UNIQUE, NOT NULL, DEFAULT)
7. **Triggers asociados** que se ejecutan sobre la tabla
8. **Políticas RLS** (Row Level Security) implementadas
9. **Consideraciones** de diseño y arquitectura
10. **Ejemplo de registro** típico

**Plantilla específica para tablas:**

```sql
--[Fecha y Hora]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Descripción del propósito de la tabla
--
--[Campos]:
--   - campo1 (tipo): Descripción del campo
--   - campo2 (tipo): Descripción del campo
--
--[Claves]:
--   - PK: nombre_campo - Descripción
--   - FK: nombre_campo -> tabla_referenciada(campo) - Descripción
--
--[Índices]:
--   - idx_nombre: Descripción y justificación
--
--[Restricciones]:
--   - Restricción CHECK: Descripción
--   - Restricción UNIQUE: Descripción
--
--[Triggers]:
--   - trigger_nombre: Descripción de su función
--
--[Políticas RLS]:
--   - Política: Descripción de la política de seguridad
--
--[Relaciones]:
--   - Tabla relacionada 1: Tipo de relación y descripción
--   - Tabla relacionada 2: Tipo de relación y descripción
--
--[Ejemplo de registro]:
--   INSERT INTO tabla_nombre (...) VALUES (...);
```

#### Funciones
1. **Descripción completa** del propósito y comportamiento
2. **Parámetros** con tipos y descripciones
3. **Valores de retorno** con tipos y descripciones
4. **Casos de uso** y ejemplos prácticos
5. **Relaciones** con otras tablas o funciones
6. **Validaciones** implementadas
7. **Manejo de errores** (si aplica)
8. **Consideraciones de seguridad** (SECURITY DEFINER/INVOKER)

#### Triggers
1. **Función asociada** que ejecuta
2. **Eventos** que lo activan (INSERT, UPDATE, DELETE)
3. **Timing** (BEFORE, AFTER, INSTEAD OF)
4. **Comportamiento** detallado por evento
5. **Relaciones** con otras tablas
6. **Consideraciones** de rendimiento

#### Vistas
1. **Propósito** y casos de uso
2. **Tablas base** utilizadas
3. **Joins** y relaciones importantes
4. **Campos calculados** y su lógica
5. **Filtros** aplicados
6. **Funciones asociadas** (si existen)
7. **Consideraciones** de rendimiento

## 🔐 Convenciones de Naming

### Nombres de Archivos
- **Tablas**: `tabla_nombre_tabla.sql`
- **Funciones**: `tabla_funcion_descripcion.sql`
- **Triggers**: `trigger_tabla_accion.sql`
- **Vistas**: `v_nombrevista.sql`

### Nombres en Código
- **Tablas y campos**: Usar comillas dobles si tienen mayúsculas: `"nombreCampo"`
- **Funciones**: snake_case: `nombre_funcion`
- **Variables**: Prefijo v_: `v_variable_local`
- **Parámetros**: Prefijo p_: `p_parametro_entrada`

## 📋 Documentación Adicional

### README.md por Carpeta
Cada carpeta debe incluir un README.md con:

1. **Descripción de la tabla** principal
2. **Lista de componentes** con descripción breve
3. **Flujo de procesamiento** (diagrama ASCII)
4. **Comportamiento detallado** por componente
5. **Instrucciones de instalación**
6. **Estado actual** (conteo de componentes)
7. **Notas importantes**

### Scripts de Instalación
Cada carpeta debe incluir `instalar_todo.sql` con:

1. **Orden correcto** de instalación (tabla primero, luego funciones, triggers y vistas)
2. **Verificación final** de componentes instalados
3. **Mensajes informativos** sobre el proceso

## 🚀 Proceso de Documentación

### Para Nuevas Tablas
1. Crear archivo `tabla_nombre_tabla.sql` en carpeta correspondiente
2. Incluir encabezado completo con fecha y hora actual
3. Documentar todos los campos, claves y restricciones
4. Documentar políticas RLS
5. Incluir ejemplo de registro típico
6. Crear README.md de la carpeta
7. Crear script de instalación
8. Actualizar README.md general

### Para Nuevos Componentes (Funciones/Triggers/Vistas)
1. Crear archivo SQL en carpeta correspondiente
2. Incluir encabezado completo con fecha y hora actual
3. Documentar comportamiento detallado
4. Agregar ejemplos de uso
5. Actualizar README.md de la carpeta
6. Actualizar scripts de instalación si es necesario
7. Actualizar README.md general

### Para Componentes Existentes
1. Revisar documentación existente
2. Completar información faltante
3. Actualizar ejemplos si es necesario
4. Verificar que cumpla con estándares actuales

## ✅ Checklist de Calidad

Antes de considerar completa la documentación:

### Para Tablas
- [ ] Encabezado completo con fecha y hora
- [ ] Descripción clara del propósito de la tabla
- [ ] Todos los campos documentados con tipos y descripciones
- [ ] Claves primarias y foráneas documentadas
- [ ] Índices documentados con justificación
- [ ] Restricciones documentadas
- [ ] Triggers asociados listados
- [ ] Políticas RLS documentadas
- [ ] Relaciones con otras tablas descritas
- [ ] Ejemplo de registro incluido
- [ ] README.md de carpeta creado
- [ ] Script de instalación creado

### Para Funciones/Triggers/Vistas
- [ ] Encabezado completo con fecha y hora
- [ ] Descripción clara del propósito
- [ ] Parámetros documentados (si aplica)
- [ ] Valores de retorno documentados (si aplica)
- [ ] Ejemplos de uso incluidos
- [ ] Relaciones con otros componentes documentadas
- [ ] Validaciones descritas (si aplica)
- [ ] Consideraciones de seguridad incluidas
- [ ] README.md de carpeta actualizado
- [ ] Scripts de instalación actualizados

## 📚 Ejemplos de Referencia

Consultar los siguientes archivos como referencia:

- `catUsers/tabla_catusers.sql` (Definición de tabla)
- `catUsers/funciones y trigger/catusers_actualizar_nivel_desde_perfil.sql` (Función trigger)
- `empresas/vistas/v_resumenempresas.sql` (Vista)
- `empresas/funciones y trigger/README.md` (README de carpeta)
- `instalar_todo_general.sql` (Script de instalación)

## 🔄 Mantenimiento de la Documentación

La documentación debe mantenerse actualizada con cada cambio en los componentes. Revisar y actualizar periódicamente para asegurar que refleje el estado actual del sistema.

## 📝 Orden de Instalación Recomendado

Al crear scripts de instalación, seguir este orden:

1. **Tablas** (de las más independientes a las más dependientes)
2. **Funciones** (de las más básicas a las más complejas)
3. **Triggers** (después de las funciones que utilizan)
4. **Vistas** (al final, ya que dependen de tablas y funciones)
5. **Políticas RLS** (después de todo lo anterior)

Este orden asegura que todas las dependencias estén satisfechas durante la instalación.