# Análisis de la Tabla catUsers - Usuarios, Tipos y Permisos

## [Fecha y Hora]: 07/11/2025 05:44:00

## Resumen Ejecutivo
Este documento presenta un análisis detallado de la tabla `catUsers` del sistema supaSPH, enfocado en la estructura de usuarios, tipos de perfiles, sistema de permisos y mecanismos de control de acceso implementados.

## 1. Estructura de la Tabla catUsers

### Campos Principales
- **uid**: UUID único identificador del usuario (clave primaria)
- **fc**: Fecha y hora de creación del registro
- **status**: Booleano que indica si el usuario está activo (true) o inactivo (false)
- **nombre**: Nombre del usuario
- **apellidos**: Apellidos del usuario
- **email**: Correo electrónico del usuario
- **telefono**: Teléfono de contacto
- **idPerfil**: Nivel de perfil (relación con tabla perfil)
- **isSupport**: Booleano que indica si es usuario de soporte
- **img**: URL de imagen de perfil
- **uidSupervisor**: UUID del supervisor (texto)
- **nomCompleto**: Nombre completo concatenado
- **prueba**: Campo de prueba (valores: "1", null)
- **rol**: Rol especial (ej: "RC" para Responsable Comercial)
- **fechaBanneo**: Fecha y hora de banneo del usuario
- **infoBanneo**: JSON con historial completo de banneos

## 2. Tipos de Usuarios y Perfiles

### Perfiles Definidos (tabla perfil)
1. **Soporte** (nivel: 1)
   - 4 usuarios activos
   - 57.6% de permisos activos en promedio
   - Acceso amplio a módulos del sistema

2. **Gerencia** (nivel: 2)
   - 4 usuarios activos
   - 45.0% de permisos activos en promedio
   - Permisos de supervisión y aprobación

3. **Administrador** (nivel: 3)
   - 7 usuarios (algunos inactivos)
   - 27.8% de permisos activos en promedio
   - Acceso a configuraciones del sistema

4. **Cobranza** (nivel: 4)
   - 0 usuarios activos
   - Perfil definido pero sin uso actual

5. **Ventas** (nivel: 5)
   - 27 usuarios (mayoría activos)
   - 20.7% de permisos activos en promedio
   - Acceso principalmente a módulos de CRM y ventas

### Distribución de Usuarios
- **Total de usuarios**: 42 registrados
- **Usuarios activos**: ~32 (76%)
- **Usuarios inactivos**: ~10 (24%)
- **Usuarios de soporte**: 3 (isSupport = true)
- **Usuarios con rol RC**: 8 (Responsables Comerciales)

## 3. Sistema de Permisos (segModulosUsuarios)

### Estructura de Permisos
- **55 módulos** diferentes definidos en el sistema
- **Claves numéricas** para cada permiso (ej: 201-206 para gestión de usuarios)
- **Módulos principales**:
  - Configuraciones (claves 200-240)
  - CRM (claves 300-340)
  - Cuentas por Pagar (claves 400-450)
  - Fideicomiso (claves 500-520)
  - Inversionistas (claves 600-630)
  - Parques (claves 700-710)
  - Arrendatarios (claves 10-30)
  - Comisiones (clave 100)

### Permisos Específicos para Usuarios (claves 201-206)
- **201**: Ver todos los usuarios
- **202**: Crear usuarios
- **203**: Modificar usuarios
- **204**: Eliminar usuarios
- **205**: Banear usuarios
- **206**: Gestionar perfiles

### Distribución de Permisos por Perfil
- **Soporte**: Mayor cantidad de permisos activos (49/55 en un caso)
- **Gerencia**: Permisos intermedios (17-42 permisos activos)
- **Administrador**: Permisos variables (0-25 permisos activos)
- **Ventas**: Permisos limitados (1-30 permisos activos)

## 4. Políticas RLS Implementadas

### Políticas de Acceso a catUsers
1. **catusers_select_propio_registro**
   - Permite a usuarios ver solo su propio registro
   - Condición: `uid = auth.uid()`

2. **catusers_select_ver_todos_usuarios**
   - Permite a usuarios con permiso 201 ver todos los usuarios
   - Verifica en segModulosUsuarios

3. **catusers_insert_crear_usuarios**
   - Permite a usuarios con permiso 202 crear nuevos usuarios
   - Verifica en segModulosUsuarios

4. **catusers_update_propio_registro**
   - Permite a usuarios modificar solo su propio registro
   - Condición: `uid = auth.uid()`

5. **catusers_update_modificar_usuarios**
   - Permite a usuarios con permiso 203 modificar cualquier usuario
   - Verifica en segModulosUsuarios

6. **catusers_delete_eliminar_usuarios**
   - Permite a usuarios con permiso 204 eliminar usuarios
   - Verifica en segModulosUsuarios

## 5. Roles Especiales

### isSupport (Usuario de Soporte)
- **3 usuarios activos** con este rol
- **Alto nivel de permisos** (36-49 permisos activos)
- **Acceso especial** a módulos de configuración y mantenimiento

### rol = "RC" (Responsable Comercial)
- **8 usuarios** con este rol
- **Principalmente en perfil Ventas**
- **Algunos tienen supervisor asignado** (uidSupervisor)
- **Función**: Gestión de leads y procesos comerciales

### uidSupervisor
- **Campo texto** que almacena UUID del supervisor
- **Usuarios con supervisor**: Julieta Romero Novales, Mariana Pulquero Martinez
- **Relación jerárquica** para organigramas comerciales

## 6. Mecanismos de Banneo y Control de Acceso

### Sistema de Banneo
- **fechaBanneo**: Timestamp del último banneo
- **infoBanneo**: JSON con historial completo de banneos

### Estructura de infoBanneo
```json
{
  "actual": "baneado|activo",
  "contador": 3,
  "movimientos": [
    {
      "id": 1,
      "admin": "UUID_del_administrador",
      "fecha": "2025-07-23T23:12:12.939439+00:00",
      "accion": "banneo|desbanneo",
      "motivo": "Descripción del motivo"
    }
  ]
}
```

### Casos Detectados
- **Alexis Trejo**: Baneado actualmente (status: false)
- **Ollin Malinalli Díaz**: Baneado actualmente (status: false)
- **Sergio Luengas**: Historial de 3 movimientos (baneado → desbaneado → desbaneado)

### Control de Acceso
- **status**: Control principal de acceso (true/false)
- **Combinación con RLS**: Restricciones a nivel de base de datos
- **Validación en tiempo real**: Las políticas RLS verifican permisos en cada operación

## 7. Flujo de Asignación de Permisos

### Proceso de Creación de Usuario
1. **Registro inicial** en catUsers con perfil básico
2. **Asignación de permisos** en segModulosUsuarios
3. **Configuración de roles especiales** (isSupport, rol, uidSupervisor)
4. **Activación** del usuario (status = true)

### Jerarquía de Permisos
1. **Nivel de Perfil** (idPerfil) → Define permisos base
2. **Permisos Específicos** (segModulosUsuarios) → Refinamiento granular
3. **Roles Especiales** (isSupport, rol) → Funcionalidades adicionales
4. **Políticas RLS** → Validación final en base de datos

## 8. Diagramas de Arquitectura

### Diagrama de Relaciones
```
catUsers
├── perfil (idPerfil → nivel)
├── segModulosUsuarios (uid → uid)
├── catUsers (uidSupervisor → uid) [autoreferencia]
└── Políticas RLS (auth.uid() → uid)
```

### Diagrama de Jerarquía de Permisos
```
Administrador (nivel 3)
├── Permisos de configuración
├── Gestión de usuarios (201-206)
└── Acceso a todos los módulos

Gerencia (nivel 2)
├── Permisos de supervisión
├── Aprobaciones (CxP, CRM)
└── Reportes avanzados

Soporte (nivel 1)
├── Acceso completo al sistema
├── Mantenimiento de datos
└── Soporte técnico

Ventas (nivel 5)
├── Módulos CRM (300-340)
├── Gestión de leads
└── Reportes de ventas
```

## 9. Observaciones y Patrones

### Patrones Identificados
1. **Usuarios de Ventas** son el grupo más numeroso (64% del total)
2. **Soporte** tiene mayor porcentaje de permisos activos (57.6%)
3. **Administradores** tienen permisos variables, sugiriendo asignación personalizada
4. **Usuarios inactivos** mantienen sus permisos en la base de datos
5. **Rol RC** principalmente asignado a usuarios de Ventas

### Casos Especiales
- **SIN ASIGNAR**: Usuario placeholder con perfil Ventas, sin permisos activos
- **Usuarios baneados**: Mantienen registro histórico completo en infoBanneo
- **Supervisión**: Algunos usuarios RC tienen supervisor asignado

## 10. Recomendaciones

### Seguridad
1. **Auditoría periódica** de usuarios inactivos con permisos activos
2. **Revisión de permisos** para usuarios de Ventas con acceso elevado
3. **Política de expiración** para cuentas inactivas prolongadas
4. **Validación de supervisores** para asegurar consistencia jerárquica

### Optimización
1. **Estandarización** de permisos por perfil para reducir variabilidad
2. **Automatización** de asignación de permisos base según perfil
3. **Documentación** de criterios para rol RC y asignación de supervisores
4. **Monitoreo** de patrones de uso de permisos por perfil

### Mantenimiento
1. **Limpieza** de usuarios de prueba o placeholder
2. **Actualización** de perfiles sin usuarios asignados (Cobranza)
3. **Revisión** de permisos sin uso prolongado
4. **Optimización** de consultas RLS para mejor rendimiento

## 11. Conclusiones

El sistema de gestión de usuarios de supaSPH presenta una arquitectura robusta con:
- **Control de acceso granular** mediante permisos específicos
- **Seguridad multinivel** con perfiles, permisos y RLS
- **Flexibilidad** para roles especiales y casos particulares
- **Trazabilidad** completa de acciones de administración

Sin embargo, existen oportunidades de mejora en:
- **Estandarización** de asignación de permisos
- **Automatización** de procesos de gestión
- **Monitoreo** continuo de accesos y permisos
- **Documentación** más detallada de criterios de asignación

---

*Este análisis se basa en los datos actuales de producción y puede requerir actualización periódica para reflejar cambios en el sistema.*