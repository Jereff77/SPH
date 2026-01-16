@echo off
echo ========================================
echo   DIAGNÓSTICO DE POLÍTICA RLS - NAVES
echo ========================================
echo.

REM Verificar si Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado o no está en el PATH
    echo    Por favor, instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
echo.

REM Verificar si las dependencias están instaladas
if not exist "node_modules\pg" (
    echo 📦 Instalando dependencias...
    npm install pg dotenv
    if %errorlevel% neq 0 (
        echo ❌ ERROR: No se pudieron instalar las dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
    echo.
)

REM Ejecutar el script de diagnóstico
echo 🚀 Ejecutando diagnóstico de política RLS...
echo.
node diagnosticar_simple.js
echo.

echo ========================================
echo   DIAGNÓSTICO COMPLETADO
echo ========================================
pause