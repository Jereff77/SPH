# PRD - SPH Control de Accesos

## Información del Documento

| Campo | Valor |
|-------|-------|
| **Fecha de creación** | 24 de diciembre de 2025 |
| **Versión** | 1.0 |
| **Estado** | Producción |
| **Autoría** | SPH Bines Raíces |
| **Repositorio** | SPH_appQR |

---

## 1. Resumen Ejecutivo

**SPH Control de Accesos** es una aplicación web progresiva (PWA) diseñada para la generación y gestión de códigos QR de acceso para visitantes en desarrollos inmobiliarios de SPH Bienes Raíces. La aplicación permite a los usuarios autorizados generar y compartir códigos de acceso QR para diferentes tipos de visitantes, con control de límites diarios y gestión de inventario.

### Propuesta de Valor

- **Automatización**: Generación instantánea de códigos de acceso válidos
- **Control**: Límites diarios de acceso por empresa para gestionar afluencia
- **Trazabilidad**: Registro completo de visitantes y accesos generados
- **Movilidad**: Interfaz optimizada para dispositivos móviles
- **Integración**: Compartir directamente vía WhatsApp con los visitantes

---

## 2. Usuarios y Roles

### 2.1 Usuario Principal (Operador/Recepcionista)

**Perfil**: Personal de seguridad o recepción en desarrollos inmobiliarios de SPH.

**Responsabilidades**:
- Generar códigos QR de acceso para visitantes
- Registrar nuevos visitantes en el sistema
- Compartir códigos de acceso vía WhatsApp
- Consultar visitantes registrados previamente

**Permisos**:
- Leer/escribir datos de visitantes de su empresa
- Generar códigos QR sujetos a límites diarios
- Acceder a historial de visitantes de su empresa

### 2.2 Administrador de Empresa

**Perfil**: Gerente o encargado de seguridad de cada empresa/cliente de SPH.

**Responsabilidades**:
- Configurar límites diarios de QR
- Gestionar inventario de QR packs
- Ver reportes de uso

**Permisos**: (No implementado en v1.0, roadmap)

---

## 3. Historias de Usuario

### HU-001: Inicio de Sesión

**Como** operador de acceso,
**Quiero** iniciar sesión en la aplicación,
**Para** poder generar códigos de acceso para visitantes.

**Criterios de Aceptación**:
- [x] Usuario puede ingresar email y contraseña
- [x] Email se recuerda en localStorage para próxima sesión
- [x] Sistema valida credenciales contra Supabase Auth
- [x] Usuario se asocia a empresa mediante tabla `catUsers`
- [x] Error se muestra claramente si credenciales son inválidas

**Prioridad**: Must-have

---

### HU-002: Generación de QR - Uso General

**Como** operador de acceso,
**Quiero** generar un código QR de "Uso General" para un visitante,
**Para** permitir su acceso al desarrollo el día específico.

**Criterios de Aceptación**:
- [x] Operador selecciona tipo "Uso General"
- [x] Sistema muestra disponibilidad restante del día (límite diario - uso actual)
- [x] Operador selecciona visitante existente o registra uno nuevo
- [x] Operador selecciona fecha de visita
- [x] Sistema genera clave de acceso alfanumérica de 15 caracteres
- [x] Sistema valida que no se exceda límite diario de la empresa
- [x] QR se muestra en pantalla con código y datos del visitante
- [x] Registro se guarda en tabla `qrGenerados`

**Validaciones**:
- [x] Si límite diario alcanzado, mostrar alerta y bloquear generación
- [x] La identificación oficial del visitante es obligatoria para nuevos visitantes

**Prioridad**: Must-have

---

### HU-003: Generación de QR - Administrativo

**Como** operador de acceso,
**Quiero** generar un código QR "Administrativo" sin restricciones diarias,
**Para** permitir acceso a personal autorizado sin límites.

**Criterios de Aceptación**:
- [x] Operador selecciona tipo "Administrativo"
- [x] Sistema muestra "(Ilimitado)" en disponibilidad
- [x] No se valida contra límite diario de la empresa
- [x] Resto del flujo igual que Uso General

**Prioridad**: Must-have

---

### HU-004: Registro de Nuevo Visitante

**Como** operador de acceso,
**Quiero** registrar un nuevo visitante en el sistema,
**Para** poder generarle un código de acceso.

**Criterios de Aceptación**:
- [x] Operador ingresa nombre completo
- [x] Operador ingresa teléfono con formato mexicano automático
- [x] Operador puede ingresar tipo de vehículo (Ligero/Carga)
- [x] Operador puede ingresar placas de vehículo
- [x] Operador carga imagen de identificación oficial (OBLIGATORIO)
- [x] Imagen se sube a Supabase Storage (bucket `identificaciones`)
- [x] Visitante se guarda en tabla `datosVisitantes`
- [x] QR se genera automáticamente después de registrar visitante

**Validaciones**:
- [x] Nombre es requerido
- [x] Identificación (imagen) es requerida
- [x] Teléfono se formatea automáticamente: (###) ###-####
- [x] Formato de teléfono acepta máximo 10 dígitos

**Prioridad**: Must-have

---

### HU-005: Selección de Visitante Existente

**Como** operador de acceso,
**Quiero** seleccionar un visitante previamente registrado,
**Para** generarle un nuevo código de acceso sin volver a registrarlo.

**Criterios de Aceptación**:
- [x] Lista muestra todos los visitantes de la empresa ordenados por nombre
- [x] Cada opción muestra nombre y placas (si existen)
- [x] Sistema recuerda última selección entre sesiones (roadmap)

**Prioridad**: Must-have

---

### HU-006: Compartir QR por WhatsApp

**Como** operador de acceso,
**Quiero** compartir el código QR generado vía WhatsApp,
**Para** que el visitante lo tenga en su teléfono.

**Criterios de Aceptación**:
- [x] Botón genera imagen del QR usando html2canvas
- [x] Imagen incluye: logo, código QR, clave alfanumérica, nombre, tipo, fecha
- [x] Sistema intenta usar Web Share API primero (móvil)
- [x] Fallback a clipboard + abrir WhatsApp Web (escritorio)
- [x] Fallback final: descarga de imagen + instrucciones
- [x] Mensaje incluye saludo personalizado con nombre del visitante

**Prioridad**: Must-have

---

### HU-007: Consulta de Uso Diario

**Como** operador de acceso,
**Quiero** ver cuántos códigos "Uso General" me quedan disponibles hoy,
**Para** planificar mejor la generación de accesos.

**Criterios de Aceptación**:
- [x] Selector de tipo muestra disponibilidad en tiempo real
- [x] Para "Uso General": muestra "(X disp. hoy)"
- [x] Para "Administrativo": muestra "(Ilimitado)"
- [x] Cálculo se basa en: `límite diario - QRs generados hoy de tipo Uso General`

**Nota Técnica**:
- [x] Consulta usa chunking de IDs (max 10) por limitación de URL en Supabase/PostgREST
- [x] Consultas secuenciales para evitar ERR_ABORTED

**Prioridad**: Must-have

---

### HU-008: Cierre de Sesión

**Como** operador de acceso,
**Quiero** cerrar mi sesión en la aplicación,
**Para** mantener la seguridad de mi cuenta.

**Criterios de Aceptación**:
- [x] Botón de logout cierra sesión de Supabase Auth
- [x] Estado de la aplicación se limpia
- [x] Usuario redirigido a pantalla de login

**Prioridad**: Must-have

---

## 4. Requerimientos Funcionales

### RF-001: Autenticación

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| RF-001.1 | Login con email y contraseña usando Supabase Auth | Must-have |
| RF-001.2 | Asociación de usuario autenticado con registro en `catUsers` | Must-have |
| RF-001.3 | Persistencia de email en localStorage | Must-have |
| RF-001.4 | Logout con limpieza de estado | Must-have |

### RF-002: Gestión de Visitantes

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| RF-002.1 | Crear nuevo visitante con datos personales y vehiculares | Must-have |
| RF-002.2 | Cargar imagen de identificación a Supabase Storage | Must-have |
| RF-002.3 | Consultar visitantes por empresa | Must-have |
| RF-002.4 | Listar visitantes ordenados alfabéticamente | Must-have |

### RF-003: Generación de QR

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| RF-003.1 | Generar clave de acceso única de 15 caracteres alfanuméricos | Must-have |
| RF-003.2 | Generar código QR visual usando `react-qr-code` | Must-have |
| RF-003.3 | Validar límite diario para tipo "Uso General" | Must-have |
| RF-003.4 | Sin límite para tipo "Administrativo" | Must-have |
| RF-003.5 | Registrar QR en tabla `qrGenerados` | Must-have |
| RF-003.6 | Actualizar contador de uso diario en tiempo real | Must-have |

### RF-004: Compartir

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| RF-004.1 | Generar imagen del QR con html2canvas | Must-have |
| RF-004.2 | Web Share API para móvil nativo | Must-have |
| RF-004.3 | Clipboard fallback para desktop | Must-have |
| RF-004.4 | Descarga fallback como última opción | Must-have |

---

## 5. Requerimientos No Funcionales

### RNF-001: Performance

| ID | Descripción | Métrica |
|----|-------------|---------|
| RNF-001.1 | Tiempo de generación de QR | < 2 segundos |
| RNF-001.2 | Tiempo de carga de imagen de QR | < 3 segundos |
| RNF-001.3 | Tiempo de login | < 3 segundos |

### RNF-002: Seguridad

| ID | Descripción |
|----|-------------|
| RNF-002.1 | Autenticación via Supabase Auth con JWT |
| RNF-002.2 | Row Level Security (RLS) en tablas de Supabase |
| RNF-002.3 | Las credenciales se pasan como build args en Docker (no en runtime) |
| RNF-002.4 | HTTPS obligatorio en producción |
| RNF-002.5 | Las imágenes de identificación se almacenan en bucket privado con URLs firmadas |

### RNF-003: Disponibilidad

| ID | Descripción | Métrica |
|----|-------------|---------|
| RNF-003.1 | Uptime objetivo | 99.5% |
| RNF-003.2 | Tiempo de recuperación | < 5 minutos |

### RNF-004: Compatibilidad

| ID | Descripción | Plataformas |
|----|-------------|-------------|
| RNF-004.1 | Navegadores soportados | Chrome 90+, Safari 14+, Firefox 88+, Edge 90+ |
| RNF-004.2 | Dispositivos móviles | iOS 14+, Android 10+ |
| RNF-004.3 | Viewport | Optimizado para 320px-480px (móvil) |

### RNF-005: Escalabilidad

| ID | Descripción |
|----|-------------|
| RNF-005.1 | Arquitectura sin estado (stateless) |
| RNF-005.2 | Despliegue vía Docker con nginx |
| RNF-005.3 | Base de datos PostgreSQL en Supabase (escalable) |

---

## 6. Modelo de Datos

### 6.1 Diagrama Entidad-Relación Simplificado

```
┌─────────────────┐
│   catUsers      │
├─────────────────┤
│ uid (PK)        │───→ Supabase Auth
│ nombre          │
│ apellidos       │
│ idEmpresa (FK)  │───→ empresas.idEmpresa
│ email           │
└─────────────────┘
        │
        │ usa la app
        ↓
┌─────────────────┐       ┌─────────────────┐
│ qrEmpresas      │       │ datosVisitantes │
├─────────────────┤       ├─────────────────┤
│ idQrEmpresas(PK)│       │ idVisitante (PK)│
│ tipoQR          │       │ nomVisitante    │
│ idEmpresa (FK)  │       │ telefonoVisitante│
│ disponibles     │       │ tipoVehiculo    │
│ vigente         │       │ placasVehiculo  │
└─────────────────┘       │ urlIdentificacion│
        │                 │ idEmpresa (FK)  │
        │                 │ uidr (FK)        │
        │                 └─────────────────┘
        │                         │
        │                         │ requiere
        ↓                         ↓
┌─────────────────┐       ┌─────────────────┐
│ qrGenerados     │◄──────│ idVisitante (FK)│
├─────────────────┤       └─────────────────┘
│ idQR (PK)       │
│ claveAcceso     │
│ idQrEmpresas(FK)│
│ fechaValidez    │
│ tipoQR          │
│ status          │
│ vigencia        │
│ tipoVehiculo    │
│ placasVehiculo  │
│ estado          │
│ limiteUsos      │
│ usos            │
│ fc (fecha crea) │
└─────────────────┘
```

### 6.2 Descripción de Tablas

#### catUsers

| Campo | Tipo | Descripción |
|-------|------|-------------|
| uid | string | UUID de Supabase Auth (PK) |
| nombre | string? | Nombre del usuario |
| apellidos | string? | Apellidos del usuario |
| idEmpresa | string? | FK a empresas |
| email | string? | Email del usuario |

#### empresas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| idEmpresa | string | Identificador único (PK) |
| nombreEmpresa | string | Nombre de la empresa |
| qrDiarios | int? | Límite diario de QRs "Uso General" |
| qrLigero | int? | Límite diario para vehículos ligeros (reservado) |
| qrCarga | int? | Límite diario para vehículos de carga (reservado) |

#### qrEmpresas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| idQrEmpresas | string | UUID (PK) |
| tipoQR | string? | Tipo: "Uso General" o "Administrativo" |
| idEmpresa | string? | FK a empresas |
| disponibles | int? | Cantidad disponible en inventario |
| vigente | boolean? | Si el pack está activo |

#### datosVisitantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| idVisitante | string | UUID (PK) |
| nomVisitante | string? | Nombre completo |
| telefonoVisitante | string? | Teléfono con formato mexicano |
| tipoVehiculo | string? | "Ligero" o "Carga" |
| placasVehiculo | string? | Placas del vehículo |
| urlIdentificacion | string? | URL de imagen en Supabase Storage |
| idEmpresa | string | FK a empresas |
| uidr | string | FK a catUsers (usuario que registró) |

#### qrGenerados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| idQR | string | UUID (PK) |
| claveAcceso | string | Código de 15 caracteres alfanuméricos |
| idVisitante | string? | FK a datosVisitantes |
| idQrEmpresas | string? | FK a qrEmpresas |
| fechaValidez | string? | Fecha de validez (YYYY-MM-DD) |
| tipoQR | string? | "Uso General" o "Administrativo" |
| status | boolean | Estado activo/inactivo |
| vigencia | boolean | Si está vigente |
| tipoVehiculo | string? | Heredado del visitante |
| placasVehiculo | string? | Heredado del visitante |
| estado | int? | Estado numérico (1=activo) |
| limiteUsos | int? | Límite de usos del QR |
| usos | int? | Contador de usos actuales |
| fc | string | Fecha de creación (ISO timestamp) |

---

## 7. Flujos de Usuario

### 7.1 Flujo Principal: Generar QR para Visitante

```
┌─────────────────────────────────────────────────────────────────┐
│                         INICIO                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ¿Autenticado?   │
                    └─────────────────┘
                      │            │
                     No            Sí
                      │            │
                      ▼            ▼
              ┌──────────────┐   │
              │ Pantalla de  │   │
              │ Login        │   │
              └──────────────┘   │
                      │            │
                      ▼            ▼
                    ┌─────────────────┐
                    │ Seleccionar     │
                    │ Tipo de QR      │
                    │ (Uso Gen/Admin) │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ¿Visitante      │
                    │ existe?         │
                    └─────────────────┘
                      │            │
                     No            Sí
                      │            │
                      ▼            ▼
              ┌──────────────┐  ┌──────────────┐
              │ Registrar    │  │ Seleccionar  │
              │ Nuevo        │  │ Visitante    │
              │ Visitante    │  │ Existente    │
              └──────────────┘  └──────────────┘
                      │            │
                      └──────┬─────┘
                             ▼
                    ┌─────────────────┐
                    │ Seleccionar     │
                    │ Fecha de Visita │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Validar         │
                    │ Disponibilidad  │
                    │ (solo Uso Gen)  │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Generar QR      │
                    │ + Clave Acceso  │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Mostrar QR      │
                    │ + Opciones      │
                    │ Compartir       │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ¿Compartir por  │
                    │ WhatsApp?       │
                    └─────────────────┘
                      │            │
                     No            Sí
                      │            │
                      ▼            ▼
              ┌──────────────┐  ┌──────────────┐
              │ Generar Otro │  │ Web Share /  │
              │ QR           │  │ Clipboard /  │
              └──────────────┘  │ Descargar    │
                                └──────────────┘
                                      │
                                      ▼
                                ┌──────────────┐
                                │     FIN      │
                                └──────────────┘
```

---

## 8. Reglas de Negocio

### RN-001: Límites Diarios

- **Regla**: Cada empresa tiene un límite diario de códigos "Uso General" configurado en `empresas.qrDiarios`
- **Validación**: Antes de generar un QR "Uso General", verificar que `(límite diario - uso actual) > 0`
- **Cálculo de uso actual**: Contar registros en `qrGenerados` donde:
  - `tipoQR = 'Uso General'`
  - `fc` esté dentro del día actual (00:00:00 a 23:59:59)
  - `idQrEmpresas` pertenezca a la empresa

### RN-002: Tipos de QR

| Tipo | Límite Diario | Fuente de Límite |
|------|---------------|------------------|
| Uso General | Sí | `empresas.qrDiarios` |
| Administrativo | No | Ilimitado |

### RN-003: Formato de Teléfono

- **Formato esperado**: `(###) ###-####`
- **Validación**: Solo 10 dígitos numéricos
- **Comportamiento**: Formateo automático mientras el usuario escribe

### RN-004: Identificación Obligatoria

- **Regla**: Todo nuevo visitante debe cargar imagen de identificación oficial
- **Validación**: El campo `newVisitorIdImage` es requerido
- **Almacenamiento**: Imagen subida a bucket `identificaciones` en Supabase Storage
- **Patrón de ruta**: `{idEmpresa}/{randomFileName}.{ext}`

### RN-005: Clave de Acceso

- **Longitud**: 15 caracteres
- **Caracteres**: A-Z (mayúsculas) y 0-9
- **Generación**: Aleatoria sin repetición en el sistema
- **Unicidad**: No se valida duplicados (riesgo aceptable por espacio muestral grande)

### RN-006: URL Chunking

- **Problema**: Supabase/PostgREST tiene límite de longitud de URL
- **Solución**: Dividir consultas con muchos IDs en chunks de 10
- **Implementación**: Consultas secuenciales (no paralelas) para evitar `net::ERR_ABORTED`

---

## 9. Stack Tecnológico

### Frontend

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Framework | React | 19.x |
| Lenguaje | TypeScript | ^5.x |
| Build Tool | Vite | ^6.x |
| CSS Framework | Tailwind CSS | v4 |
| Renderizado QR | react-qr-code | ^4.x |
| Generación Imagen | html2canvas | ^1.x |
| Íconos | lucide-react | ^0.x |

### Backend / BaaS

| Componente | Tecnología |
|------------|------------|
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (bucket `identificaciones`) |
| RLS | Supabase Row Level Security |

### Despliegue

| Componente | Tecnología |
|------------|------------|
| Contenedor | Docker (multi-stage) |
| Web Server | nginx (Alpine) |
| Reverse Proxy | nginx |
| Build Args | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## 10. Arquitectura

### 10.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        Usuario Final                         │
│                    (Operador/Recepcionista)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (PWA)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    React App                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │  Login   │  │ QR Form  │  │ QR Display/Share │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                      ↓ ↑ ↓ ↑ ↓ ↑                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Client SDK                       │
│                   (supabase-js / TS)                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   Auth API  │  │  Database   │  │  Storage    │
    │             │  │ (PostgreSQL)│  │             │
    │   JWT       │  │  + RLS      │  │  Files      │
    │             │  │             │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘
```

### 10.2 Estructura del Proyecto

```
SPH_appQR/
├── public/                  # Assets estáticos
├── src/
│   ├── main.tsx            # Entry point
│   ├── App.tsx             # Componente principal (single-file)
│   ├── index.css           # Estilos globales + Tailwind
│   ├── lib/
│   │   └── supabaseClient.ts  # Cliente de Supabase
│   └── types/
│       └── db.ts           # Interfaces TypeScript
├── Dockerfile              # Multi-stage build
├── nginx.conf              # Configuración nginx
├── tailwind.config.js      # Configuración Tailwind
├── tsconfig.json           # Configuración TypeScript
├── vite.config.ts          # Configuración Vite
└── package.json            # Dependencias
```

---

## 11. Diseño UI/UX

### 11.1 Paleta de Colores (SPH Brand)

| Token | Valor Hex | Uso |
|-------|-----------|-----|
| `sph-light` | #F2F2F2 | Fondo principal |
| `sph-text` | #6B6B6B | Texto principal |
| `sph-primary` | #1F2D4A | Navegación, botones primarios, acentos |

### 11.2 Layout

- **Viewport**: Optimizado para móvil (max-width: 480px)
- **Header**: Sticky, con logo + botón logout
- **Secciones**: Cards blancas con bordes sutiles
- **Tipografía**: Sans-serif, jerarquía clara

### 11.3 Componentes Principales

1. **Login**: Formulario centrado con email/password
2. **QR Type Selector**: Dropdown con disponibilidad en tiempo real
3. **Visitor Selector**: Toggle entre buscar/nuevo visitante
4. **Date Picker**: Input nativo de fecha
5. **Generate Button**: CTA principal, prominent
6. **QR Display**: Centrado, con código impreso y código de barras visual
7. **Share Button**: Integración con WhatsApp

---

## 12. Métricas de Éxito (KPIs)

| KPI | Descripción | Objetivo |
|-----|-------------|----------|
| Tiempo de Generación | Tiempo desde click hasta QR visible | < 2 seg |
| Tasa de Error | Porcentaje de errores en generación | < 1% |
| Adopción | Porcentaje de empresas usando el sistema | > 80% |
| Satisfacción | Encuesta NPS de usuarios | > 7/10 |
| Uso Diario | Promedio de QRs generados por empresa | Métrica de salud |

---

## 13. Roadmap

### Versión 1.0 (Actual)

- [x] Autenticación y autorización
- [x] Generación de QR (Uso General + Administrativo)
- [x] Registro de visitantes
- [x] Límites diarios
- [x] Compartir por WhatsApp
- [x] Despliegue Docker

### Versión 1.1 (Corto Plazo)

- [ ] Historial de QRs generados
- [ ] Reenvío de QRs previamente generados
- [ ] Búsqueda de visitantes por nombre/placas
- [ ] Validación de QR en acceso (lector escanea clave)
- [ ] Reporte de uso diario/semanal

### Versión 2.0 (Mediano Plazo)

- [ ] Panel administrativo por empresa
- [ ] Configuración de límites diarios por empresa
- [ ] Gestión de inventario de QR packs
- [ ] Notificaciones push de accesos
- [ ] Múltiples desarrollos por empresa
- [ ] Dashboard de analytics

### Versión 3.0 (Largo Plazo)

- [ ] App nativa (React Native)
- [ ] Integración con sistemas de control de acceso hardware
- [ ] Reconocimiento facial
- [ ] Pre-registro de visitantes por portal web
- [ ] API para integraciones terceras

---

## 14. Riesgos y Mitigación

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Caída de Supabase | Alto | Baja | Monitoreo 24/7, SLA de Supabase |
| Límite de URL excedido | Alto | Media | Chunking implementado, consultas secuenciales |
| Almacenamiento de IDs lleno | Medio | Baja | Limpieza periódica de imágenes |
| Usuarios sin empresa | Medio | Media | Validación en onboarding |
| Imágenes muy pesadas | Bajo | Alta | Validación de tamaño en frontend |
| Duplicación de claves | Bajo | Muy baja | Espacio muestral 36^15 |

---

## 15. Testing

### 15.1 Casos de Prueba

| ID | Caso de Prueba | Pasos | Resultado Esperado |
|----|----------------|-------|-------------------|
| CP-001 | Login exitoso | Ingresar credenciales válidas | Redirección a home |
| CP-002 | Login fallido | Ingresar credenciales inválidas | Mensaje de error |
| CP-003 | Generar QR Uso General | Seleccionar tipo, visitante, fecha | QR generado, contador actualizado |
| CP-004 | Exceder límite diario | Generar QRs hasta límite + 1 | Alerta, sin generación |
| CP-005 | Generar QR Administrativo | Seleccionar Admin, completar formulario | QR generado, sin validación de límite |
| CP-006 | Nuevo visitante sin ID | Llenar formulario sin imagen | Error, validación de ID requerida |
| CP-007 | Compartir WhatsApp | Generar QR y click en compartir | Imagen generada y compartida |
| CP-008 | Formato teléfono | Ingresar 10 dígitos | Formato (###) ###-#### aplicado |

### 15.2 Pruebas de Estrés

| ID | Escenario | Métrica |
|----|-----------|---------|
| PE-001 | 100 usuarios concurrentes | Tiempo de respuesta < 3s |
| PE-002 | Generar 50 QRs en sesión | Sin degradación de UI |
| PE-003 | Imagen de ID de 5MB | Subida exitosa, resize si necesario |

---

## 16. Documentación de Soporte

### 16.1 Guías de Usuario

- [Guía de Inicio Rápido](./guias/inicio-rapido.md) (pendiente)
- [Guía de Generación de QRs](./guias/generar-qr.md) (pendiente)
- [Preguntas Frecuentes](./guias/faq.md) (pendiente)

### 16.2 Documentación Técnica

- [Guía de Despliegue](./tecnica/despliegue.md) (CLAUDE.md)
- [Diagrama de Base de Datos](./tecnica/bd.md) (CLAUDE.md)
- [API Reference](./tecnica/api.md) (pendiente)

---

## 17. Glossary

| Término | Definición |
|---------|------------|
| **QR Uso General** | Código de acceso para visitantes regulares, sujeto a límite diario |
| **QR Administrativo** | Código de acceso para personal autorizado, sin límites diarios |
| **Límite Diario** | Cantidad máxima de QRs "Uso General" que una empresa puede generar por día |
| **Clave de Acceso** | Código alfanumérico de 15 caracteres único para cada QR |
| **Chunking** | Técnica de dividir consultas grandes en partes más pequeñas |
| **RLS** | Row Level Security - Seguridad a nivel de fila en Supabase |
| **PWA** | Progressive Web App - Aplicación web progresiva |

---

## 18. Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2025-12-24 | PRD inicial basado en implementación existente |

---

**Fin del Documento PRD v1.0**
