---
modulo: Autenticación
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-15
submodulos: [Login, Recuperar, Restablecer, Cambiar contraseña]
rutas: [/login, /recuperar, /restablecer, /configuraciones/cambiar-contrasena]
claves_permiso: []
tablas: [catUsers, SPHConfiguraciones]
palabras_clave: [login, iniciar sesión, contraseña, password, usuario, correo, dominio, sesión, token, cerrar sesión, recuperar, olvidé mi contraseña, restablecer, enlace de recuperación, correo de recuperación]
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
| Recuperar | `/recuperar` | Solicitar el enlace de recuperación ("Olvidé mi contraseña"). |
| Restablecer | `/restablecer` | Definir la nueva contraseña al abrir el enlace del correo. |
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

## 5b. Recuperar contraseña ("Olvidé mi contraseña") — flujo público

Es el flujo para quien **no recuerda** su contraseña (sin sesión). Replica el mecanismo del sistema viejo
(v1): el **correo de recuperación lo envía Supabase**, igual que antes. Lo nuevo es que en v2 **el
frontend nunca habla con Supabase**: todo pasa por el backend (frontera de confianza).

Flujo del usuario:
1. En el login pulsa **«¿Olvidaste tu contraseña?» → Recupérala** (`/recuperar`).
2. Escribe su **usuario o correo** y pulsa "Enviar enlace de recuperación". El backend resuelve el correo
   (mismos dominios/correos autorizados que el login) y, si la cuenta existe y está **activa**, dispara el
   **correo de recuperación de Supabase** con un enlace de retorno a `/restablecer`.
3. La pantalla muestra **siempre** el mismo aviso ("Si existe una cuenta asociada, te enviamos un
   enlace…"), exista o no la cuenta (anti-enumeración).
4. El usuario abre el enlace del correo → cae en **`/restablecer`** (el token de recuperación viaja en el
   fragmento de la URL). Define su **nueva contraseña** (≥ 8, con confirmación) y la guarda.
5. El backend verifica ese token (JWT de recuperación de Supabase) y fija la nueva contraseña. Listo: ya
   puede iniciar sesión.

Cómo funciona por dentro (técnico):
- `POST /api/auth/recuperar {usuario}` → `solicitarRecuperacion()` resuelve el correo y llama a
  `resetPasswordForEmail(email, {redirectTo: APP_WEB_URL/restablecer})` **server-side**. No envía correo a
  usuarios inactivos. Respuesta genérica.
- `POST /api/auth/restablecer {accessToken, nueva}` → `restablecerConToken()` verifica el JWT (mismo
  secreto/issuer/audiencia que el resto de la app) y cambia la contraseña con `admin.updateUserById`. La
  **posesión del token** (que solo llega al correo del usuario) es la prueba de identidad.
- Ambos endpoints son **públicos** (sin sesión) y con **rate limiting** (recuperar 5/min, restablecer
  10/min). Archivos: `apps/api/src/modules/auth/{auth.controller,auth.service,auth.schemas}.ts`;
  `apps/web/src/features/auth/{RecuperarPage,RestablecerPage}.tsx`.

## 6. ⚠️ Detalles no obvios (gotchas)

1. El login NO usa contraseña en el campo de usuario: resuelve el correo a partir del **usuario** y los
   **dominios/correos autorizados** de `SPHConfiguraciones`. Si un usuario no puede entrar con su nombre
   corto, probablemente su dominio no está autorizado → usar correo completo o agregar el dominio.
2. Dos personas con el mismo usuario y distinto dominio deben usar el **correo completo**.
3. La sesión sobrevive a recargar la página gracias a la cookie httpOnly; pero NO sobrevive a "cerrar
   sesión" ni si el refresh token expira/revoca.
4. El modo **"Ver como"** (soporte) no cambia la sesión real (ver `auditoria-y-ver-como.md`).
5. **Recuperar contraseña depende de la config de Supabase Auth:** la URL `APP_WEB_URL/restablecer` (y
   `http://localhost:5173/restablecer` en local) debe estar en **Authentication → URL Configuration →
   Redirect URLs** del proyecto Supabase. Si no, el enlace del correo regresa al Site URL (la app vieja) y
   el restablecimiento no funciona. El correo lo envía Supabase con su plantilla de "Reset Password"
   (mismo proyecto que v1) y está sujeto a sus límites de envío.
6. El token de recuperación **caduca pronto** (vida corta del enlace de Supabase): si el usuario tarda,
   verá "Enlace no válido o ha expirado" y deberá solicitar uno nuevo.

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
| "No me llegó el correo de recuperación." | Cuenta inexistente/inactiva (no se envía), correo en spam, o límite de envío de Supabase. | Revisar spam; verificar que el usuario exista y esté activo; reintentar tras unos minutos. |
| "El enlace de recuperación dice que no es válido o expiró." | El enlace caducó o ya se usó. | Solicitar uno nuevo en `/recuperar`. |
| "El enlace me lleva al sistema viejo / no a /restablecer." | Falta la Redirect URL de v2 en Supabase. | Agregar `APP_WEB_URL/restablecer` en Authentication → URL Configuration (ver §6.5). |

**Cuándo escalar a ticket:** usuario que debería poder entrar y no puede tras verificar dominio/estado;
sospecha de cuenta bloqueada o problemas de Supabase Auth; no llega el correo de recuperación pese a tener
cuenta activa (posible límite/SMTP de Supabase).

## 9. Estado y pendientes

- ✅ Login por usuario/correo, refresh por cookie, /me, bloqueo de inactivos, cambiar contraseña,
  rate limiting, JWT verificado con algoritmo/issuer/audience.
- ✅ **Recuperar/Restablecer contraseña** (v2.27.2): flujo público completo replicando el correo nativo de
  Supabase de v1, pero server-side (frontera de confianza). Ver §5b.
- ⏳ Acción operativa: registrar `APP_WEB_URL/restablecer` (+ localhost) en las Redirect URLs del proyecto
  Supabase para que el enlace del correo funcione end-to-end (ver §6.5).
