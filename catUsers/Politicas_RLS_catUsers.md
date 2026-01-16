# Políticas RLS para la tabla catUsers

## [Fecha y Hora]: 12/10/2025 06:48:00

## Descripción
Documento que describe las políticas de Row Level Security (RLS) implementadas para la tabla `catUsers`. Estas políticas garantizan que los usuarios solo puedan acceder y modificar su propio registro.

## Claves de Permisos (definidas en segModulosUsuarios)
- **201**: Ver todos los usuarios
- **202**: Crear usuarios
- **203**: Modificar usuarios
- **204**: Eliminar usuarios
- **205**: Banear usuarios
- **206**: Gestionar perfiles

## Políticas Implementadas

### 1. Política: catusers_select_propio_registro
- **Tipo**: SELECT
- **Descripción**: Permite a los usuarios autenticados ver únicamente su propio registro en la tabla catUsers
- **Condición**: `uid = auth.uid()`
- **Aplica a**: Usuarios autenticados (authenticated)

### 2. Política: catusers_select_ver_todos_usuarios
- **Tipo**: SELECT
- **Descripción**: Permite a los usuarios con permiso clave 201 ver todos los registros de la tabla catUsers
- **Condición**: Verifica si el usuario tiene el permiso "Ver todos los usuarios" (clave 201) activo en segModulosUsuarios
- **Aplica a**: Usuarios con permiso clave 201 activo

### 3. Política: catusers_insert_crear_usuarios
- **Tipo**: INSERT
- **Descripción**: Permite a los usuarios con permiso clave 202 crear nuevos usuarios en la tabla catUsers
- **Condición**: Verifica si el usuario tiene el permiso "Crear usuarios" (clave 202) activo en segModulosUsuarios
- **Aplica a**: Usuarios con permiso clave 202 activo

### 4. Política: catusers_update_propio_registro
- **Tipo**: UPDATE
- **Descripción**: Permite a los usuarios autenticados modificar únicamente su propio registro en la tabla catUsers
- **Condición**: `uid = auth.uid()`
- **Aplica a**: Usuarios autenticados (authenticated)

### 5. Política: catusers_update_modificar_usuarios
- **Tipo**: UPDATE
- **Descripción**: Permite a los usuarios con permiso clave 203 modificar cualquier usuario en la tabla catUsers
- **Condición**: Verifica si el usuario tiene el permiso "Modificar usuarios" (clave 203) activo en segModulosUsuarios
- **Aplica a**: Usuarios con permiso clave 203 activo

### 6. Política: catusers_delete_eliminar_usuarios
- **Tipo**: DELETE
- **Descripción**: Permite a los usuarios con permiso clave 204 eliminar usuarios de la tabla catUsers
- **Condición**: Verifica si el usuario tiene el permiso "Eliminar usuarios" (clave 204) activo en segModulosUsuarios
- **Aplica a**: Usuarios con permiso clave 204 activo

## Consideraciones Importantes

1. **Sistema de permisos integrado**: Las políticas utilizan la tabla segModulosUsuarios para validar los permisos específicos de cada usuario según las claves 201-206.

2. **Combinación de políticas**: Los usuarios pueden tener múltiples políticas aplicadas simultáneamente. Por ejemplo, un usuario puede ver su propio registro y, si tiene permiso 201, también puede ver todos los usuarios.

3. **Validación en tiempo real**: Las políticas verifican los permisos en tiempo real cada vez que se ejecuta una operación, asegurando que los cambios en segModulosUsuarios se reflejen inmediatamente en los accesos.

2. **Validación por UID**: Todas las políticas utilizan el campo `uid` (UUID) para identificar al usuario y compararlo con `auth.uid()`, que es el UID del usuario autenticado en Supabase.

3. **Seguridad**: Estas políticas reemplazan las políticas anteriores que permitían acciones adicionales basadas en permisos especiales. Ahora las reglas son más restrictivas y se centran únicamente en el acceso al propio registro.

## Instrucciones de Ejecución

Para aplicar estas políticas, ejecuta el script `Politicas_RLS_catUsers.sql` con un usuario que tenga permisos de owner en la tabla catUsers.

```bash
# Ejemplo de ejecución con psql
psql -h tu-host -U tu-usuario -d tu-base-de-datos -f Politicas_RLS_catUsers.sql
```

O si usas el cliente de Supabase:

```bash
supabase db push
```

## Verificación

Después de ejecutar el script, puedes verificar que las políticas se han creado correctamente con:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'catUsers' AND schemaname = 'public'
ORDER BY policyname;
```

## Pruebas Recomendadas

1. **Prueba de SELECT propio**: Verifica que un usuario solo pueda ver su propio registro
2. **Prueba de SELECT con permiso 201**: Verifica que un usuario con permiso 201 pueda ver todos los usuarios
3. **Prueba de INSERT con permiso 202**: Verifica que solo usuarios con permiso 202 puedan crear nuevos usuarios
4. **Prueba de UPDATE propio**: Verifica que un usuario pueda modificar su propio registro
5. **Prueba de UPDATE con permiso 203**: Verifica que un usuario con permiso 203 pueda modificar cualquier usuario
6. **Prueba de DELETE con permiso 204**: Verifica que solo usuarios con permiso 204 puedan eliminar usuarios
7. **Prueba de acceso no autorizado**: Verifica que usuarios sin permisos específicos no puedan realizar operaciones restringidas
4. **Prueba de denegación DELETE**: Verifica que un usuario no pueda eliminar ningún registro (incluyendo el suyo)