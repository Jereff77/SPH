--[Fecha y Hora]: 05/02/2026 03:45:00
--[Descripción]: Script de instalación para todas las funciones de presupuestos
--                Este script instala las funciones necesarias para la gestión de presupuestos
--
--[Uso]: Ejecutar este script para instalar todas las funciones de presupuestos
--
--[Componentes instalados]:
--   - presdetalle_crear_registros_completos: Crea 12 registros mensuales para una categoría
--   - prescategorias_obtener_con_presupuesto: Obtiene categorías con presupuesto anual calculado
--
--[Tablas documentadas]:
--   - PresDetalle: Almacena el desglose mensual de los presupuestos por categoría
--   - Ver documentación completa en: ../PresDetalle.md

-- Instalar función para crear registros completos de presupuesto
\i presdetalle_crear_registros_completos.sql

-- Instalar función para obtener categorías con presupuesto anual
\i prescategorias_obtener_con_presupuesto.sql

-- Mensaje de confirmación
SELECT '=====================================================' as separador;
SELECT 'MÓDULO DE PRESUPUESTOS INSTALADO' as mensaje;
SELECT 'Funciones instaladas:' as detalle;
SELECT '- presdetalle_crear_registros_completos: Función para crear 12 registros mensuales' as funcion1;
SELECT '- prescategorias_obtener_con_presupuesto: Función para obtener categorías con presupuesto anual' as funcion2;
SELECT 'Tablas documentadas:' as tablas;
SELECT '- PresDetalle: Almacena el desglose mensual de los presupuestos por categoría' as tabla1;
SELECT '- Ver documentación completa en: ../PresDetalle.md' as doc_ref;
SELECT '=====================================================' as separador;
SELECT 'Instalación completada exitosamente' as mensaje_final;