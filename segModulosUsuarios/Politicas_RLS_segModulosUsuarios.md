# Políticas RLS para la tabla segModulosUsuarios

## [Fecha y Hora]: 12/10/2025 07:03:00

## Descripción
Documento que describe las políticas de Row Level Security (RLS) implementadas para la tabla `segModulosUsuarios`. Estas políticas controlan el acceso a la gestión de permisos de usuarios basándose en el sistema de módulos y claves de permisos específicas (201-206).

## Claves de Permisos
- **201**: Ver todos los usuarios
- **202**: Crear usuarios
- **203**: Modificar usuarios
- **204**: Eliminar usuarios
- **205**: Banear usuarios
- **206**: Gestionar perfiles

## Políticas Implementadas

### 1. Política: segmodulosusuarios_select_propios
- **Tipo**: SELECT
- **Descripción**: Permite a los usuarios autenticados ver únicamente sus propios permisos en la tabla segModulosUsuarios
- **Condición**: `uid = auth.uid()`
- **Aplica a**: Usuarios autenticados (authenticated)

## Consideraciones Importantes

1. **Prevención de recursión infinita**: Las políticas fueron simplificadas para evitar bucles infinitos que ocurrían cuando las políticas consultaban la misma tabla para validarse.

2. **Acceso básico para catUsers**: Esta política permite que la tabla catUsers pueda consultar los permisos necesarios para sus propias políticas RLS.

3. **Sin políticas de administrador**: Se eliminó la política de administrador para evitar problemas de permisos con la tabla auth.users.

4. **Sin políticas de modificación**: Las operaciones de modificación sobre segModulosUsuarios deben ser manejadas por administradores o a través de funciones específicas para evitar inconsistencias.

## Instrucciones de Ejecución

Para aplicar estas políticas, ejecuta el script `Politicas_RLS_segModulosUsuarios.sql` con un usuario que tenga permisos de owner en la tabla segModulosUsuarios.

```bash
# Ejemplo de ejecución con psql
psql -h tu-host -U tu-usuario -d tu-base-de-datos -f Politicas_RLS_segModulosUsuarios.sql
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
WHERE tablename = 'segModulosUsuarios' AND schemaname = 'public'
ORDER BY policyname;
```

## Pruebas Recomendadas

1. **Prueba de SELECT propio**: Verifica que un usuario solo pueda ver sus propios permisos
2. **Prueba de denegación**: Verifica que usuarios no puedan ver permisos de otros usuarios
3. **Prueba de integración con catUsers**: Verifica que las políticas de catUsers puedan consultar correctamente los permisos en segModulosUsuarios