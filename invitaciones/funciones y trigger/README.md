# Funciones y Triggers para la tabla invitaciones

Este directorio contiene las funciones relacionadas con el sistema de invitaciones del proyecto supaSPH-QR.

## 📁 Archivos

### Funciones

1. **`validar_invitacion.sql`**
   - **Tipo**: Función de validación (SECURITY DEFINER)
   - **Propósito**: Validar invitaciones y retornar información completa
   - **Salida**: JSON con datos de la invitación, perfil y validaciones

## 🔄 Flujo de Procesamiento

```
Llamada a validar_invitacion(id_ext)
    ↓
Busca invitación en tabla invitaciones
    ↓
Une con tabla catPerfiles
    ↓
Realiza validaciones (status, fechaUso, fechaExpiracion)
    ↓
Retorna JSON con toda la información
```

## 🚀 Instalación

Las funciones se instalan individualmente con cada archivo SQL.

## 📋 Comportamiento Detallado

### Función validar_invitacion
1. Busca la invitación por ID externo (15 caracteres)
2. Obtiene datos del perfil asociado
3. Realiza validaciones de estado:
   - Invitación activa (status = true)
   - No utilizada previamente (fechaUso IS NULL)
   - No expirada (fechaExpiracion > NOW())
4. Retorna JSON con:
   - Datos completos de la invitación
   - Información del perfil
   - Resultado de validaciones
   - Mensaje explicativo

## 🔐 Seguridad

- **validar_invitacion**: SECURITY DEFINER con search_path = 'public'
- Permite validación segura sin exponer estructura interna

## 📊 Estado Actual

- **Funciones documentadas**: 1
- **Relaciones con otras tablas**: invitaciones, catPerfiles
- **Impacto**: Validación completa del sistema de registro por invitación

## 📝 Notas

- La función retorna toda la información necesaria en una sola llamada
- Incluye validaciones de negocio (expiración, uso previo)
- El ID externo de 15 caracteres es seguro y no expone UUIDs internos
- Los mensajes de validación son claros para el usuario final