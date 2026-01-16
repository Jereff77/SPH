# Funciones y Triggers para la tabla catUsers

Este directorio contiene las funciones y triggers relacionados con la tabla `catUsers` en el proyecto supaSPH-QR.

## 📁 Archivos

### Funciones

1. **`catusers_actualizar_nivel_desde_perfil.sql`**
   - **Tipo**: Función Trigger
   - **Propósito**: Actualiza automáticamente el campo `nivel` cuando cambia `idPerfil`
   - **Sincronización**: Unidireccional (idPerfil → nivel)

2. **`catusers_llenar_nomcompleto.sql`**
   - **Tipo**: Función Trigger
   - **Propósito**: Genera automáticamente `nomCompleto` y `UID` si es necesario
   - **Comportamiento**: Concatena nombre y apellidos

3. **`catusers_marcar_invitacion_usada.sql`**
   - **Tipo**: Función Trigger (SECURITY DEFINER)
   - **Propósito**: Marca invitaciones como usadas cuando se crea un usuario
   - **Relación**: Con tabla `invitaciones`

4. **`catusers_registrar_nuevo_usuario.sql`**
   - **Tipo**: Función de registro (SECURITY DEFINER)
   - **Propósito**: Registra nuevos usuarios validando email en auth.users
   - **Validaciones**: Email, empresa, perfil, invitación (opcional)
   - **Seguridad**: Prevención de inyección SQL con parámetros tipados
   - **Actualización automática**: Cambia status de invitación a false cuando se usa
   - **Conversión automática**: Convierte 'null' (texto) a NULL real para idEmpresa

5. **`catusers_validar_insercion.sql`**
   - **Tipo**: Función de validación (SECURITY DEFINER)
   - **Propósito**: Valida si un usuario puede ser insertado basado en invitación válida
   - **Uso**: En políticas RLS

6. **`validar_permiso_usuario.sql`**
   - **Tipo**: Función de validación
   - **Propósito**: Valida si usuario tiene permiso activo para una clave específica
   - **Uso**: Validar acceso antes de mostrar funcionalidades

### Triggers

1. **`trigger_catusers_actualizar_nivel_desde_perfil.sql`**
   - **Eventos**: INSERT, UPDATE
   - **Timing**: BEFORE
   - **Función**: `catusers_actualizar_nivel_desde_perfil()`

2. **`trigger_catusers_llenar_nomcompleto.sql`**
   - **Eventos**: INSERT, UPDATE
   - **Timing**: BEFORE
   - **Función**: `catusers_llenar_nomcompleto()`

3. **`trigger_catusers_marcar_invitacion_usada.sql`**
   - **Eventos**: INSERT
   - **Timing**: AFTER
   - **Función**: `catusers_marcar_invitacion_usada()`

## 🔄 Flujo de Procesamiento

```
INSERT/UPDATE en catUsers
    ↓
trigger_catusers_actualizar_nivel_desde_perfil (BEFORE)
    ↓
catusers_actualizar_nivel_desde_perfil() → Actualiza nivel
    ↓
trigger_catusers_llenar_nomcompleto (BEFORE)
    ↓
catusers_llenar_nomcompleto() → Genera UID y nomCompleto
    ↓
Se guarda el registro
    ↓
trigger_catusers_marcar_invitacion_usada (AFTER)
    ↓
catusers_marcar_invitacion_usada() → Marca invitación como usada
```

## 🚀 Instalación

Usar el script `instalar_todo.sql` para instalar todos los componentes en orden automático.

## 📋 Comportamiento Detallado

### Triggers - INSERT en catUsers
1. Si `idPerfil` tiene valor → establece `nivel` automáticamente
2. Si `uid` es NULL → genera UUID automáticamente
3. Si `nombre` y/o `apellidos` tienen valor → genera `nomCompleto`
4. Si `idInvitacion` tiene valor → marca invitación como usada

### Triggers - UPDATE en catUsers
1. Si cambia `idPerfil` → actualiza `nivel` automáticamente
2. Si cambian `nombre` y/o `apellidos` → actualiza `nomCompleto`

### Función - catusers_registrar_nuevo_usuario
**Validaciones realizadas:**
- Parámetros obligatorios no nulos
- Formato de email válido usando regex
- Email existente en auth.users (no eliminado)
- Usuario no duplicado en catUsers
- Empresa existente y activa
- Perfil existente
- Invitación válida (si se proporciona)
- Prevención de inyección SQL con parámetros tipados

**Resultados de ejecución y casos de prueba:**

1. **Ejecución exitosa (registro correcto)**:
   ```sql
   SELECT catusers_registrar_nuevo_usuario(
       'Jereff','Lopez','jereff@aceleremos.com',
       'db417159-8c1d-47b6-b3ac-2ed8098b0b05',
       '797ac6db-4a16-4341-90e4-b62225901dc4',
       NULL,NULL,
       '{"Parques": [{"idParque": "b8EiKD9wSs9h"}]}'::jsonb
   );
   ```
   **Resultado**: `d121777d-9f33-431a-8437-41ff0b00bd35` (UUID del usuario creado)
   
   **Verificación del registro**:
   ```sql
   SELECT "uid", "nombre", "apellidos", "email", "idEmpresa", "idPerfil", "parques"
   FROM public."catUsers" WHERE "email" = 'jereff@aceleremos.com';
   ```
   **Datos registrados**:
   - UID: d121777d-9f33-431a-8437-41ff0b00bd35
   - Nombre: Jereff
   - Apellidos: Lopez
   - Email: jereff@aceleremos.com
   - Empresa: CACAHUANANCHE (db417159-8c1d-47b6-b3ac-2ed8098b0b05)
   - Perfil: Administrador Empresa (797ac6db-4a16-4341-90e4-b62225901dc4)
   - Parques: {"Parques": [{"idParque": "b8EiKD9wSs9h"}]}

2. **Intento de registro duplicado (prevención correcta)**:
   ```sql
   SELECT catusers_registrar_nuevo_usuario(
       'jereff','Lopez','jereff@aceleremos.com',
       'db417159-8c1d-47b6-b3ac-2ed8098b0b05',
       '797ac6db-4a16-4341-90e4-b62225901dc4',
       '(123) 456-7890',
       '7dc66fe8-cf75-42a7-a01a-f4c4faf423a0',
       '{"Parques": [{"idParque": "b8EiKD9wSs9h"}]}'::jsonb
   );
   ```
   **Resultado**: `null` (usuario ya existente)
   
   **Motivo**: La función detectó que el usuario ya estaba registrado y evitó el duplicado, devolviendo `null` como está diseñada.

**Comportamiento observado:**
- ✅ Función crea usuarios correctamente cuando todos los datos son válidos
- ✅ Función previene duplicados exitosamente
- ✅ Validaciones de email, empresa y perfil funcionan correctamente
- ✅ Estructura JSON de parques se almacena correctamente
- ✅ Parámetros opcionales (teléfono, invitación) se manejan adecuadamente
- ✅ Actualización automática de invitación: cambia status a false, registra fechaUso, uidUsuarioCreado y motivoCierre

**Nueva funcionalidad agregada:**
Cuando el registro es exitoso y se proporciona una invitación, la función automáticamente:
- Cambia el status de la invitación a `false`
- Registra la fecha de uso (`fechaUso`)
- Asocia el UID del usuario creado (`uidUsuarioCreado`)
- Registra el email usado (`emailUsuarioCreado`)
- Agrega comentarios con timestamp y UID del usuario
- Establece el motivo de cierre como 'USADO'

**Prueba de funcionalidad de actualización de invitación:**

3. **Ejecución con actualización automática de invitación**:
   ```sql
   SELECT catusers_registrar_nuevo_usuario(
       'Test','User','test@aceleremos.com',
       'db417159-8c1d-47b6-b3ac-2ed8098b0b05',
       '797ac6db-4a16-4341-90e4-b62225901dc4',
       '5551234567',
       'e19cea11-508c-43c6-a90a-8d773e56ca3f',
       '{"Parques": [{"idParque": "b8EiKD9wSs9h"}]}'::jsonb
   );
   ```
   **Resultado**: `6665c4cb-e3a2-4ffb-8bd9-c00a01bfd44b` (UUID del usuario creado)
   
   **Verificación de actualización de invitación**:
   ```sql
   SELECT "idInvitaciones", correo, status, "fechaUso", "uidUsuarioCreado",
          "emailUsuarioCreado", "motivoCierre", "comentarios"
   FROM public."invitaciones"
   WHERE "idInvitaciones" = 'e19cea11-508c-43c6-a90a-8d773e56ca3f';
   ```
   **Datos actualizados en la invitación**:
   - Status: false (cambiado de true automáticamente)
   - FechaUso: 2025-10-18 23:58:29.788083
   - uidUsuarioCreado: 6665c4cb-e3a2-4ffb-8bd9-c00a01bfd44b
   - emailUsuarioCreado: test@aceleremos.com
   - motivoCierre: USADO
   - comentarios: "Usuario registrado exitosamente | Invitación utilizada el 2025-10-18 23:58:29.788083+00 para registrar usuario con UID: 6665c4cb-e3a2-4ffb-8bd9-c00a01bfd44b"

**Comportamiento validado de actualización automática:**
- ✅ Status de invitación cambia a false automáticamente
- ✅ FechaUso se registra con timestamp exacto del registro
- ✅ UID del usuario creado se asocia correctamente
- ✅ Email del usuario se registra en la invitación
- ✅ MotivoCierre se establece como 'USADO'
- ✅ Comentarios se actualizan con información detallada del registro

### Función - validar_permiso_usuario
**Validaciones realizadas:**
- Usuario debe existir y estar activo (status = true)
- Usuario debe tener accesos habilitados (accesos = true)
- Módulo debe existir y estar activo (status = true)
- Usuario debe tener acceso explícito al módulo (acceso = true)

## 🔐 Seguridad

- **catusers_marcar_invitacion_usada**: SECURITY DEFINER (necesita permisos elevados)
- **catusers_validar_insercion**: SECURITY DEFINER (validación RLS)
- **Otras funciones**: SECURITY INVOKER (por defecto)

## 📊 Estado Actual

- **Funciones documentadas**: 6
- **Triggers activos**: 3
- **Relaciones con otras tablas**: auth.users, empresas, catPerfiles, invitaciones, segModulos, segModulosUsuarios
- **Políticas RLS relacionadas**: catUsers_insert_invitation_required

## 📝 Notas

- Todos los nombres con mayúsculas usan comillas dobles
- Las funciones incluyen documentación completa con fecha y hora
- Los triggers se crean con DROP IF EXISTS para evitar errores
- La sincronización de niveles es unidireccional para evitar bucles