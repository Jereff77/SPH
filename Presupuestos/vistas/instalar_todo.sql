--[Fecha y Hora]: 30/10/2025 01:28:00
--[Descripción]: Script de instalación para todas las vistas del módulo de presupuestos
--                Este script instala las vistas necesarias para el análisis y reportes de presupuestos
--
--[Uso]: Ejecutar este script para instalar todas las vistas de presupuestos
--
--[Componentes instalados]:
--   - v_resumenPresupuesto: Vista principal de resumen presupuestario
--
--[Relaciones]:
--   - Funciona con las tablas: PresDetalle, cxp
--   - Se integra con las funciones del módulo de presupuestos

-- Instalar vista principal de resumen de presupuestos
\i v_resumenPresupuesto.sql

-- Mensaje de confirmación
SELECT '=====================================================' as separador;
SELECT 'VISTAS DEL MÓDULO DE PRESUPUESTOS INSTALADAS' as mensaje;
SELECT 'Vistas instaladas:' as detalle;
SELECT '- v_resumenPresupuesto: Vista principal de resumen presupuestario con KPIs y estados de alerta' as vista1;
SELECT 'Características:' as caracteristicas;
SELECT '- Indicadores clave de desempeño (KPIs)' as caracteristica1;
SELECT '- Estados de alerta para control presupuestario' as caracteristica2;
SELECT '- Proyecciones y análisis de tendencias' as caracteristica3;
SELECT '- Filtrado automático por año en curso' as caracteristica4;
SELECT '=====================================================' as separador;
SELECT 'Instalación de vistas completada exitosamente' as mensaje_final;