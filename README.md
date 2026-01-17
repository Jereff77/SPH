# Sistema de Procesamiento de Facturas XML desde Correo Electrónico

Sistema automatizado para procesar correos electrónicos con archivos XML de facturas, extraer la información y almacenarla en una base de datos Supabase.

## Características

- ✅ Conexión segura con servidor IMAP de Hostinger
- ✅ Procesamiento automático de correos no leídos
- ✅ Extracción de datos de archivos XML CFDI
- ✅ Almacenamiento en base de datos Supabase
- ✅ Detección de duplicados por UUID
- ✅ Sistema de logging detallado
- ✅ Monitoreo continuo configurable
- ✅ Manejo robusto de errores

## Requisitos

- Python 3.8+
- Cuenta de correo en Hostinger con IMAP habilitado
- Base de datos en Supabase con tabla `catFacturas`
- Archivo `.env` con credenciales

## Instalación

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd facturas-processor
```

2. Crear entorno virtual:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows
```

3. Instalar dependencias:
```bash
pip install -r requirements.txt
```

4. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

## Configuración

Editar el archivo `.env` con las siguientes variables:

```env
# Configuración de correo IMAP
IMAP_SERVER=imap.hostinger.com
IMAP_PORT=993
IMAP_USER=tu_correo@dominio.com
IMAP_PASSWORD=tu_contraseña

# Configuración de Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_api

# Configuración del procesador
POLLING_INTERVAL=60
LOG_LEVEL=INFO
```

## Estructura de la Base de Datos

El sistema espera una tabla `catFacturas` con la siguiente estructura:

```sql
create table public."catFacturas" (
  "idFactura" text not null,
  status boolean not null default true,
  fc timestamp without time zone not null default now(),
  "folioCFDI" text null,
  "fecCFDI" timestamp without time zone null,
  "totalCFDI" double precision null,
  "subtotalCFDI" double precision null,
  moneda text null,
  "rfcEmisor" text null,
  "nombreEmisor" text null,
  "regimenFiscal" integer null,
  descripcion text null,
  "idInversionista" text null,
  "nomDescriptivo" text null,
  "idRGdet" text null,
  uidr text null,
  fum timestamp without time zone null,
  aplicada boolean not null default false,
  anio integer null default 2024,
  "idRAdet" text null,
  "uuidCFDI" text not null default ''::text,
  "selloSAT" text null,
  "noCertificadoSAT" text null,
  "mesFactura" smallint not null,
  "anioCFDI" smallint not null,
  concepto text not null default ''::text,
  manual boolean not null default false,
  constraint catFacturas_pkey primary key ("idFactura")
);
```

## Uso

### Modo Continuo (default)

Ejecuta el procesador en modo continuo, monitoreando correos cada 60 segundos:

```bash
python main.py
```

### Modo Ejecución Única

Procesa los correos actuales una sola vez y termina:

```bash
python main.py --mode once
```

### Pruebas de Conexión

Verifica que todas las conexiones funcionen correctamente:

```bash
python main.py --test
```

### Ver Estado

Muestra el estado actual del sistema:

```bash
python main.py --status
```

## Flujo de Procesamiento

1. **Conexión**: El sistema se conecta al servidor IMAP de Hostinger y a Supabase
2. **Búsqueda**: Busca correos no leídos en la bandeja de entrada
3. **Extracción**: Extrae archivos XML adjuntos de cada correo
4. **Parseo**: Procesa cada XML para extraer datos del CFDI
5. **Mapeo**: Convierte los datos a la estructura de la tabla `catFacturas`
6. **Almacenamiento**: Inserta los datos en Supabase (verificando duplicados)
7. **Marcado**: Marca los correos procesados como leídos
8. **Repetición**: Espera el intervalo configurado y repite el proceso

## Logging

El sistema genera logs detallados en:
- **Consola**: Muestra información en tiempo real
- **Archivo**: Guarda logs completos en `logs/facturas_YYYYMMDD.log`

Niveles de logging configurables:
- `DEBUG`: Información detallada para depuración
- `INFO`: Información general del proceso
- `WARNING`: Advertencias no críticas
- `ERROR`: Errores que no detienen el proceso
- `CRITICAL`: Errores críticos

## Manejo de Errores

El sistema incluye manejo robusto de errores:
- **Reintentos automáticos**: Ante fallos de conexión
- **Continuación del proceso**: Un error no detiene todo el sistema
- **Logging detallado**: Todos los errores quedan registrados
- **Validación de datos**: Verifica integridad antes de insertar

## Seguridad

- Las credenciales se almacenan en variables de entorno
- Conexión segura via SSL/TLS con servidor IMAP
- Validación de datos antes de insertar en base de datos
- Detección de duplicados para evitar inserciones múltiples

## Monitoreo

El sistema puede monitorearse mediante:
- **Dashboard Web**: Interfaz web moderna para monitoreo en tiempo real
- Logs en tiempo real
- Comando de estado (`--status`)
- Contadores de facturas procesadas
- Alertas de errores en logs

### Dashboard Web (Frontend)

El proyecto incluye un frontend web moderno para el monitoreo y control del sistema.

#### Instalación del Frontend

```bash
cd frontend
npm install
```

#### Configuración del Frontend

Crear un archivo `.env` en el directorio `frontend/`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=http://localhost:8000
```

#### Ejecutar el Frontend

```bash
cd frontend
npm run dev
```

El dashboard estará disponible en `http://localhost:5173`

#### Características del Dashboard

- **Dashboard Principal**: Estado del procesador, estadísticas en tiempo real, uptime del sistema
- **Control del Procesador**: Iniciar/detener/reiniciar el procesador (solo administradores)
- **Panel de Configuración**: Modificar intervalos de sondeo, horarios y días de actividad (solo administradores)
- **Visor de Logs**: Visualizar logs del sistema en tiempo real con filtros por nivel
- **Autenticación**: Sistema de login con roles (admin/user)

#### Build de Producción

```bash
cd frontend
npm run build
```

Los archivos de producción se generarán en `frontend/dist/`

## Troubleshooting

### Problemas Comunes

1. **Error de conexión IMAP**
   - Verificar credenciales en `.env`
   - Confirmar que IMAP esté habilitado en Hostinger
   - Revisar firewall o restricciones de red

2. **Error de conexión Supabase**
   - Verificar URL y clave API
   - Confirmar permisos en la tabla `catFacturas`
   - Revisar cuotas de uso de Supabase

3. **XML no procesado**
   - Verificar que el XML sea válido CFDI
   - Revisar namespaces en el XML
   - Consultar logs para errores específicos

### Logs de Depuración

Para habilitar logs detallados:
```env
LOG_LEVEL=DEBUG
```

## Contribución

1. Fork del proyecto
2. Crear rama de características
3. Commit de cambios
4. Push a la rama
5. Crear Pull Request

## Licencia

Este proyecto está bajo licencia MIT.

## Soporte

Para soporte técnico:
- Revisar logs de errores
- Verificar configuración
- Ejecutar pruebas de conexión
- Consultar documentación técnica