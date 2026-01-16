# Políticas de Row Level Security (RLS) - Tabla Leads (Definitivas)

## Información General
- **Tabla**: `leads`
- **Esquema**: `public`
- **RLS habilitado**: `true`
- **Fecha de creación**: 2025-10-11
- **Total de políticas**: 3

## Perfiles de Usuario Referenciados

| Nivel | Nombre del Perfil |
|-------|-------------------|
| 1     | Soporte           |
| 2     | Gerencia          |
| 3     | Administrador     |
| 4     | Cobranza          |
| 5     | Ventas            |

## Módulos de Permisos Especiales

| Clave | Módulo | Sección | Área | Descripción |
|-------|--------|---------|------|-------------|
| 325   | CRM    | Leads   | Vista Gerencial | Puede ver todos los leads con status = true |
| 326   | CRM    | Leads   | Vista Administrador de Leads | Puede ver todos los leads (status true y false) |

## Políticas de RLS Detalladas

### 1. Política: `leads_usuario_asignado_policy`
- **Tipo**: PERMISSIVE
- **Roles**: `{authenticated}`
- **Comandos**: SELECT, UPDATE
- **Propósito**: Permite a todos los usuarios ver y actualizar únicamente los leads asignados a ellos que estén activos

#### Condición (QUAL):
```sql
("uidRC" = auth.uid() AND status = true)
```

#### Condición (WITH_CHECK):
```sql
("uidRC" = auth.uid())
```

**Descripción**:
- Todos los usuarios autenticados pueden ver y actualizar los leads donde son responsables comerciales
- **Solo pueden ver leads que estén activos (status = true)**
- La condición `uidRC = auth.uid() AND status = true` asegura que solo puedan ver y modificar los leads asignados a ellos que estén activos
- No permite INSERT ni DELETE (solo SELECT y UPDATE)
- Los leads inactivos (status = false) solo son visibles para usuarios con permiso 326

---

### 2. Política: `leads_vista_gerencial_policy`
- **Tipo**: PERMISSIVE
- **Roles**: `{authenticated}`
- **Comandos**: SELECT únicamente
- **Propósito**: Permite a usuarios con permiso 325 SOLO VER todos los leads activos (status = true)

#### Condición (QUAL):
```sql
(EXISTS ( SELECT 1
   FROM "segModulosUsuarios" smu
  WHERE ((smu.uid = auth.uid()) AND (smu.clave = 325) AND (smu.acceso = true))))
```

#### Condición (WITH_CHECK):
```sql
null
```

**Descripción**:
- Usuarios con acceso al módulo CRM > Leads > Vista Gerencial (clave 325)
- Pueden ver todos los leads con status = true de todos los usuarios
- **SOLO permite operaciones de lectura (SELECT)**
- No pueden modificar, insertar ni eliminar ningún lead

---

### 3. Política: `leads_vista_administrador_policy`
- **Tipo**: PERMISSIVE
- **Roles**: `{authenticated}`
- **Comandos**: ALL (INSERT, UPDATE, SELECT, DELETE)
- **Propósito**: Permite a usuarios con permiso 326 control total sobre todos los leads

#### Condición (QUAL):
```sql
(EXISTS ( SELECT 1
   FROM "segModulosUsuarios" smu
  WHERE ((smu.uid = auth.uid()) AND (smu.clave = 326) AND (smu.acceso = true))))
```

#### Condición (WITH_CHECK):
```sql
(EXISTS ( SELECT 1
   FROM "segModulosUsuarios" smu
  WHERE ((smu.uid = auth.uid()) AND (smu.clave = 326) AND (smu.acceso = true))))
```

**Descripción**:
- Usuarios con acceso al módulo CRM > Leads > Vista Administrador de Leads (clave 326)
- Pueden ver todos los leads sin importar su status (true o false)
- **Tienen control total: INSERT, UPDATE, SELECT, DELETE**
- Pueden crear, modificar y eliminar cualquier lead del sistema

## Resumen de Accesos

### Por Tipo de Usuario:

#### Usuarios estándar (sin permisos especiales):
- Solo pueden ver y actualizar sus propios leads asignados (uidRC = auth.uid())
- Solo pueden realizar SELECT y UPDATE

#### Usuarios con permiso 325 (Vista Gerencial):
- Pueden ver todos los leads con status = true de todos los usuarios
- También pueden ver y actualizar sus propios leads asignados (por política 1)
- **SOLO pueden realizar SELECT en todos los leads (incluidos los de otros usuarios)**
- No pueden INSERTAR, ACTUALIZAR ni ELIMINAR leads de otros usuarios

#### Usuarios con permiso 326 (Vista Administrador):
- Tienen control total sobre todos los leads (INSERT, UPDATE, SELECT, DELETE)
- Pueden ver, crear, modificar y eliminar cualquier lead del sistema
- No tienen restricciones de operaciones sobre ningún lead

#### Usuarios con ambos permisos (325 y 326):
- Tienen control total sobre todos los leads (prevalece el permiso 326)
- Pueden realizar todas las operaciones sobre cualquier lead

## Jerarquía de Permisos

Las políticas son PERMISSIVE, lo que significa que se combinan con operador OR:

1. **Usuario estándar**: Solo aplica política 1 (sus leads asignados)
2. **Usuario con permiso 325**: Aplica política 1 + política 2 (sus leads + todos los activos)
3. **Usuario con permiso 326**: Aplica política 1 + política 3 (sus leads + todos los leads)
4. **Usuario con ambos permisos**: Aplica política 1 + política 2 + política 3 (acceso completo)

## Consideraciones de Seguridad

1. **Principio de mínimo privilegio**: Cada usuario tiene solo el acceso necesario
2. **Aislamiento de datos**: Los usuarios estándar solo ven sus leads asignados activos
3. **Control jerárquico**: Los permisos de módulo permiten acceso ampliado sin modificar datos
4. **Autenticación requerida**: Todas las políticas requieren que el usuario esté autenticado
5. **Protección de datos**: Solo los usuarios asignados pueden modificar sus leads
6. **Control de estado**: Los leads inactivos (status = false) solo son visibles para usuarios con permiso 326

## Implementación

Las políticas deben ser implementadas manualmente por un administrador de la base de datos con permisos de owner en la tabla leads. Los comandos SQL necesarios se encuentran en el archivo `Implementacion_Politicas_Leads_Definitivas.sql`.

**Comandos principales:**
```sql
-- Política para usuarios estándar (SELECT y UPDATE de sus leads activos)
CREATE POLICY leads_usuario_asignado_select_policy ON leads
    FOR SELECT
    TO authenticated
    USING ("uidRC" = auth.uid() AND status = true);

CREATE POLICY leads_usuario_asignado_update_policy ON leads
    FOR UPDATE
    TO authenticated
    USING ("uidRC" = auth.uid())
    WITH CHECK ("uidRC" = auth.uid());

-- Política para Vista Gerencial - SOLO LECTURA (clave 325)
CREATE POLICY leads_vista_gerencial_policy ON leads
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM "segModulosUsuarios"
                   WHERE uid = auth.uid() AND clave = 325 AND acceso = true));

-- Política para Vista Administrador - CONTROL TOTAL (clave 326)
CREATE POLICY leads_vista_administrador_policy ON leads
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM "segModulosUsuarios"
                   WHERE uid = auth.uid() AND clave = 326 AND acceso = true))
    WITH CHECK (EXISTS (SELECT 1 FROM "segModulosUsuarios"
                        WHERE uid = auth.uid() AND clave = 326 AND acceso = true));
```

---
*Documento creado el: 2025-10-11*
*Proyecto: SPH Bines Raices - Sistema de Gestión de Leads*
*Versión: 3.0 - Políticas Definitivas con Permisos de Módulo*