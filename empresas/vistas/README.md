# Vistas de la tabla empresas

Este directorio contiene las vistas relacionadas con la tabla `empresas` del proyecto supaSPH-QR.

## 📁 Archivos

### Vistas

1. **`v_resumenempresas.sql`**
   - **Tipo**: Vista materializada
   - **Propósito**: Proporcionar un resumen completo de empresas con estadísticas de QRs
   - **Función asociada**: `v_resumenempresas_buscar()` (en `../funciones y trigger/`)

## 🔄 Flujo de Procesamiento

```
empresas (tabla principal)
    ↓
LEFT JOIN qrEmpresas
    ↓
LEFT JOIN LATERAL (conteo de QRs del día)
    ↓
LEFT JOIN qrGenerados
    ↓
LEFT JOIN parques
    ↓
Subconsulta correlacionada (navesAsignadas)
    ↓
GROUP BY + Cálculos
    ↓
v_resumenempresas (vista)
```

## 📋 Campos Calculados

### Estadísticas de QRs
- **totalAsignados**: Cantidad total de QRs diarios asignados
- **disponibles**: QRs diarios disponibles para hoy (totalAsignados - usados hoy)
- **QRdiarios**: Alias de totalAsignados
- **QRLigeros**: QRs para vehículos ligeros
- **QRCarga**: QRs para vehículos de carga

### Estados y Actividad
- **activosLigeros**: QRs de vehículos ligeros activos (estado 1 o 2)
- **activosCarga**: QRs de vehículos de carga activos (estado 1 o 2)
- **accesosUtilizados**: QRs utilizados hoy (estado 3)
- **accesosEnviados**: Total de QRs enviados hoy (estados 1, 2, 3)

### Naves Asignadas
- **navesAsignadas**: Array JSON de objetos con idNave, numNaveNombre, idParque y nombreParque de todas las naves asignadas a la empresa (status = true)

## 🚀 Instalación

Las vistas se instalan individualmente con cada archivo SQL.

## 📊 Estado Actual

- **Vistas documentadas**: 1
- **Relaciones con otras tablas**: empresas, qrEmpresas, qrGenerados, parques, empresasNaves
- **Función asociada**: v_resumenempresas_buscar()
- **Impacto**: Panel de control y reportes de empresas

## 📝 Notas

- La vista utiliza LEFT JOIN para incluir empresas sin QRs asignados
- Los cálculos de disponibilidad consideran solo QRs del día actual
- Los estados de QR se interpretan como:
  - 1: Activo/Enviado
  - 2: Activo/Enviado
  - 3: Utilizado
- La vista está optimizada para consultas de panel de control
- **Actualización 17/10/2025**: Se agregó la columna `navesAsignadas` con array JSON de objetos (idNave, numNaveNombre, idParque, nombreParque) de naves asignadas