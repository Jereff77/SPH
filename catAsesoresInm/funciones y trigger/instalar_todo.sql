-- Instalación de Funciones y Triggers - catAsesoresInm
-- Fecha: 13/02/2026
-- Descripción: Script de instalación para todas las funciones y triggers asociados a la tabla catAsesoresInm

-- Instalación en orden correcto
-- 1. Primero instalar las funciones
\i catasesoresinm_validar_telefono.sql

-- Verificar instalación
SELECT 'Instalación de catAsesoresInm completada' as mensaje;
