# Funciones y Triggers para la tabla empresas

Este directorio contiene las funciones relacionadas con la gestión de empresas del proyecto supaSPH-QR.

## 📁 Archivos

### Funciones

1. **`v_resumenempresas_buscar.sql`**
   - **Tipo**: Función de consulta
   - **Propósito**: Busca y filtra empresas en la vista v_resumenempresas
   - **Filtros**: Por parque y/o por nombre de empresa/número de nave

2. **`v_resumenempresas_buscar_por_id.sql`**
   - **Tipo**: Función de consulta con filtrado de seguridad
   - **Propósito**: Busca empresa por ID filtrando naves según permisos de usuario
   - **Filtros**: Por ID de empresa y permisos de acceso a parques del usuario actual
   - **Seguridad**: Filtra navesAsignadas según parques accesibles por el usuario

### Vistas (ver ../vistas/)

1. **`v_resumenempresas.sql`**
   - **Tipo**: Vista materializada
   - **Propósito**: Proporcionar un resumen completo de empresas con estadísticas de QRs
   - **Relación**: Función asociada v_resumenempresas_buscar()

## 🔄 Flujo de Procesamiento

### Búsqueda General (v_resumenempresas_buscar)
```
Llamada a v_resumenempresas_buscar(id_parque, nombre_empresa)
    ↓
Normaliza parámetros (strings vacíos a NULL)
    ↓
Consulta vista v_resumenempresas con filtros
    ↓
Aplica búsqueda por nombre (ILIKE) y/o número de nave
    ↓
Retorna empresas que cumplen criterios
```

### Búsqueda por ID con Filtrado (v_resumenempresas_buscar_por_id)
```
Llamada a v_resumenempresas_buscar_por_id(id_empresa)
    ↓
Valida parámetros y autenticación de usuario
    ↓
Obtiene parques accesibles del usuario (catUsers.parques)
    ↓
Consulta vista v_resumenempresas por ID
    ↓
Filtra navesAsignadas según parques accesibles
    ↓
Retorna primer registro encontrado con naves filtradas
```

## 🚀 Instalación

Las funciones se instalan individualmente con cada archivo SQL o mediante el script `instalar_todo.sql`.

## 📋 Comportamiento Detallado

### Función v_resumenempresas_buscar
**Parámetros:**
- `id_parque` (text, opcional): Filtra empresas por ID de parque específico
- `nombre_empresa` (text, opcional): Busca por nombre (ILIKE) o número de nave

**Casos de uso:**
1. **Sin parámetros**: Retorna todas las empresas
2. **Solo id_parque**: Filtra empresas de ese parque
3. **Solo nombre_empresa**: Busca por nombre o número de nave
4. **Ambos parámetros**: Aplica filtros combinados (AND)

**Lógica de búsqueda por nombre_empresa:**
- Busca en `v_resumenempresas.nombreEmpresa` con ILIKE
- Busca en `naves.numNaveNombre` con ILIKE
- Incluye empresas con coincidencias en naves asignadas

### Función v_resumenempresas_buscar_por_id
**Parámetros:**
- `p_id_empresa` (uuid, requerido): ID de la empresa a buscar

**Características de seguridad:**
- Valida autenticación del usuario (auth.uid())
- Obtiene parques accesibles desde catUsers.parques (JSONB)
- Filtra navesAsignadas según permisos de parque
- Retorna solo el primer registro encontrado (LIMIT 1)

**Lógica de filtrado de naves:**
- Extrae idNave del array navesAsignadas
- Verifica que cada idNave pertenezca a un parque accesible
- Construye nuevo array JSON solo con naves permitidas
- Si no hay naves accesibles, retorna array vacío []

## 📊 Estado Actual

- **Funciones documentadas**: 2
- **Vistas documentadas**: 1
- **Relaciones con otras tablas**: v_resumenempresas, naves, empresas, qrEmpresas, qrGenerados, parques, catUsers
- **Impacto**: Búsqueda flexible de empresas con múltiples criterios, estadísticas completas y filtrado por permisos de usuario

## 📝 Notas

- Los strings vacíos ('') se tratan como NULL para facilitar el uso desde frontend
- La búsqueda por nombre usa ILIKE para ser insensible a mayúsculas/minúsculas
- La función utiliza DISTINCT para evitar duplicados cuando una empresa tiene múltiples naves
- Los resultados se ordenan por nombre de empresa para mejor presentación
- **Actualización 17/10/2025**: Se agregó v_resumenempresas_buscar_por_id() con filtrado de seguridad por parques
- La nueva función requiere autenticación y filtra resultados según permisos del usuario actual