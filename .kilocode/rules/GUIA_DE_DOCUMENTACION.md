# Guía de Documentación Estándar - Proyecto supaSPH-QR

Esta guía establece los estándares y convenciones para documentar todos los componentes que modifiquen la base de datos en el proyecto supaSPH-QR.

## 📁 Estructura de Carpetas

### Organización Principal
```
nombre_tabla/
├── funciones y trigger/    # Funciones y triggers asociados
└── vistas/                # Vistas asociadas (si existen)
```

### Ubicación por Tipo de Componente

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

1. **Lista de componentes** con descripción breve
2. **Flujo de procesamiento** (diagrama ASCII)
3. **Comportamiento detallado** por componente
4. **Instrucciones de instalación**
5. **Estado actual** (conteo de componentes)
6. **Notas importantes**

### Scripts de Instalación
Cada carpeta debe incluir `instalar_todo.sql` con:

1. **Orden correcto** de instalación
2. **Verificación final** de componentes instalados
3. **Mensajes informativos** sobre el proceso

## 🚀 Proceso de Documentación

### Para Nuevos Componentes
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

- `catUsers/funciones y trigger/catusers_actualizar_nivel_desde_perfil.sql` (Función trigger)
- `empresas/vistas/v_resumenempresas.sql` (Vista)
- `empresas/funciones y trigger/README.md` (README de carpeta)
- `instalar_todo_general.sql` (Script de instalación)

## 🔄 Mantenimiento de la Documentación

La documentación debe mantenerse actualizada con cada cambio en los componentes. Revisar y actualizar periódicamente para asegurar que refleje el estado actual del sistema.