---
modulo: Autenticación
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-04
submodulos: [Login, Recuperar, Cambiar contraseña]
rutas: [/login, /recuperar, /configuraciones/cambiar-contrasena]
claves_permiso: []
tablas: [catUsers, SPHConfiguraciones]
palabras_clave: [login, iniciar sesión, contraseña, password, usuario, correo, dominio, sesión, token, cerrar sesión, recuperar, olvidé mi contraseña]
relacionado_con: [configuraciones]
---

# Módulo: Autenticación

## 1. Identificación

- **Propósito:** iniciar/cerrar sesión, restaurar la sesión y cambiar la contraseña. Es la puerta de
  entrada al sistema.
- **A quién sirve:** todos los usuarios.
- **Sinónimos del usuario:** "entrar", "loguearme", "me sacó el sistema", "no me deja entrar".

## 2. Pantallas y rutas

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Login | `/login` | Inicio de sesión por usuario o correo. |
| Recuperar | `/recuperar` | Recuperación de contraseña. |
| Cambiar contraseña | `/configuraciones/cambiar-contrasena` | Cambia la propia contraseña (ver Configuraciones). |

## 3. Cómo funciona el login

- El campo de usuario acepta **el nombre de usuario corto** (p. ej. `jereff`) **o el correo completo**
  (`jereff@aceleremos.com`).
- El backend **resuelve el correo**: busca en `catUsers` el correo que corresponde al usuario, probando
  los **dominios autorizados** y los **correos específicos autorizados** (configurados en Sistema →
  `SPHConfiguraciones`). Si el mismo nombre de usuario existe en más de un dominio, pide el **correo
  completo** (es ambiguo).
- Autentica contra Supabase Auth (server-side). Si el usuario está **inactivo** (`status = false`), se
  bloquea el acceso.
- **Se recuerda el último usuario** que inició sesión (comodidad en el login).

## 4. Sesión y seguridad (cómo se mantiene la sesión)

- El **access token** vive **solo en memoria** del navegador (no en localStorage) → mitiga XSS.
- El **refresh token** va en una **cookie httpOnly** (`sph_rt`, `SameSite=Strict`) que el navegador no
  puede leer por JS. Al recargar la página, la sesión se restaura con esa cookie.
- Ante un **401**, el cliente intenta **renovar** la sesión una vez y reintenta; si falla, avisa "sesión
  expirada".
- El backend verifica el **JWT** (algoritmo HS256, emisor y audiencia correctos). La identidad SIEMPRE
  se toma del token verificado, nunca de datos enviados por el cliente.
- **Rate limiting:** el login está limitado (anti fuerza bruta). Tras varios intentos fallidos, responde
  con "demasiados intentos".
- **Mensajes genéricos:** ante credenciales malas dice "Credenciales inválidas" sin revelar si el usuario
  existe (anti-enumeración).

## 5. Cambiar contraseña

- Disponible para cualquier usuario autenticado. Pide la **contraseña actual** (se verifica) + la nueva
  (≥ 8 caracteres). Ver `modulos/configuraciones.md` (§7).

## 6. ⚠️ Detalles no obvios (gotchas)

1. El login NO usa contraseña en el campo de usuario: resuelve el correo a partir del **usuario** y los
   **dominios/correos autorizados** de `SPHConfiguraciones`. Si un usuario no puede entrar con su nombre
   corto, probablemente su dominio no está autorizado → usar correo completo o agregar el dominio.
2. Dos personas con el mismo usuario y distinto dominio deben usar el **correo completo**.
3. La sesión sobrevive a recargar la página gracias a la cookie httpOnly; pero NO sobrevive a "cerrar
   sesión" ni si el refresh token expira/revoca.
4. El modo **"Ver como"** (soporte) no cambia la sesión real (ver `auditoria-y-ver-como.md`).

## 7. Relaciones con otros módulos

- **Configuraciones → Sistema:** define los dominios y correos autorizados que usa el login.
- **Configuraciones → Usuarios / Permisos:** el perfil y los permisos del usuario se cargan al iniciar
  sesión y gobiernan lo que ve.

## 8. 🩺 Diagnóstico / problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No me deja entrar con mi usuario." | Su dominio no está autorizado o el usuario es ambiguo. | Probar con correo completo; si persiste, revisar dominios en Sistema. |
| "Dice usuario inactivo." | `catUsers.status = false`. | Reactivar en Configuraciones → Usuarios (con permiso). |
| "Me sacó el sistema / sesión expirada." | El refresh token expiró o se revocó. | Volver a iniciar sesión. |
| "Demasiados intentos." | Rate limiting por fuerza bruta. | Esperar un momento y reintentar. |
| "Credenciales inválidas" pero la contraseña es correcta. | Correo/usuario mal resuelto o mayúsculas. | Probar correo completo exacto. |

**Cuándo escalar a ticket:** usuario que debería poder entrar y no puede tras verificar dominio/estado;
sospecha de cuenta bloqueada o problemas de Supabase Auth.

## 9. Estado y pendientes

- ✅ Login por usuario/correo, refresh por cookie, /me, bloqueo de inactivos, cambiar contraseña,
  rate limiting, JWT verificado con algoritmo/issuer/audience.
- ⏳ Pantalla de "Recuperar" (flujo completo de restablecimiento por correo) según necesidades del cliente.
