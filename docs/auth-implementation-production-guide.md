# Auth Implementation Guide (Backend + Frontend)

## Objetivo

Este documento deja por escrito la implementacion actual de autenticacion en
`apps/web`, y define exactamente como el frontend debe consumirla en local y en
preparacion para deploy en Vercel.

Incluye:

- arquitectura actual de auth;
- endpoints y contratos;
- cookies, CSRF, sesiones y revocacion;
- migraciones requeridas;
- checklist de implementacion frontend;
- setup local y consideraciones para Vercel.

## Arquitectura actual de auth

La auth es custom (no Neon Auth gestionado), usando Neon/PostgreSQL como source
of truth.

- Persistencia de usuarios y roles: `users` en PostgreSQL.
- Hash de contrasenas: `scrypt` en backend.
- Sesion: JWT HS256 en cookie HttpOnly.
- CSRF: double-submit cookie (`blf_csrf` + `X-CSRF-Token`).
- Revocacion de sesion server-side: `users.session_version`.
- Rate limiting: persistente en PostgreSQL (`auth_rate_limits`).
- Autorizacion por rol: `admin` y `user`.

## Archivos clave

- Config runtime: `apps/web/lib/config/runtime.ts`
- Password hashing: `apps/web/lib/auth/password.ts`
- Session/JWT/CSRF: `apps/web/lib/auth/session.ts`
- HTTP pipeline (CORS, Origin, CSRF, security headers): `apps/web/lib/api/http.ts`
- Servicio de auth: `apps/web/lib/services/auth-service.ts`
- Repositorio de usuarios: `apps/web/lib/db/users.ts`
- Rate limit wrapper: `apps/web/lib/auth/rate-limit.ts`
- Rate limit en DB: `apps/web/lib/db/auth-rate-limits.ts`
- Middleware de proteccion de rutas: `apps/web/middleware.ts`
- Cliente frontend auth: `apps/web/lib/api/auth-client.ts`

## Migraciones de auth (obligatorias)

Se deben aplicar estas migraciones para tener auth completa:

1. `database/migrations/007_create_users_auth.sql`
2. `database/migrations/008_add_users_session_version.sql`
3. `database/migrations/009_create_auth_rate_limits.sql`

### Que crea cada una

- `007_create_users_auth.sql`
  - tabla `users` con `username`, `email`, `password_hash`, `role`,
    `last_login_at`, timestamps e indices.
- `008_add_users_session_version.sql`
  - columna `session_version` (default `1`) para revocar tokens previos.
- `009_create_auth_rate_limits.sql`
  - tabla `auth_rate_limits` para rate limiting persistente por `scope + key_hash + window_start`.

### Comandos locales

Ejecutar migraciones:

```bash
node scripts/dev/run-migrations.mjs
```

Crear/actualizar admin local:

```bash
node scripts/dev/create-admin-user.mjs
```

## Variables de entorno necesarias

Definidas/parseadas en `apps/web/lib/config/runtime.ts`.

### Minimas para auth local

- `DATABASE_URL`
- `AUTH_JWT_SECRET` (32+ chars recomendados)
- `AUTH_COOKIE_NAME` (default: `blf_session`)
- `AUTH_CSRF_COOKIE_NAME` (default: `blf_csrf`)
- `AUTH_SESSION_TTL_SECONDS` (default: `28800`)
- `AUTH_PASSWORD_SCRYPT_KEY_LENGTH` (default: `64`)
- `APP_ENV` (`development` en local)

### Reglas de produccion implementadas

En `APP_ENV=production`:

- `DATABASE_URL` es obligatorio;
- `GOOGLE_PLACES_API_KEY` es obligatorio (regla global del proyecto);
- `AUTH_JWT_SECRET` es obligatorio y >= 32 chars;
- `DATABASE_URL` debe incluir `sslmode=verify-full`;
- `ALLOWED_ORIGINS` es obligatorio.

## Endpoints de auth y admin

### Publicos

- `POST /api/auth/register`
- `POST /api/auth/login`
- `OPTIONS` para preflight en endpoints auth

### Autenticados

- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/logout`

### Solo admin

- `GET /api/admin/users`
- `PATCH /api/admin/users/{id}/role`

## Flujo de sesion y cookies

### Login

`POST /api/auth/login`:

1. valida payload compartido;
2. aplica rate limit por identidad e IP;
3. autentica credenciales;
4. devuelve `user`;
5. setea cookies:
   - `blf_session` (HttpOnly, SameSite=Lax, Secure en prod);
   - `blf_csrf` (no HttpOnly, usado por frontend para CSRF header).

### Logout

`POST /api/auth/logout`:

1. exige sesion valida;
2. incrementa `users.session_version` (revoca tokens emitidos antes);
3. limpia `blf_session`;
4. limpia `blf_csrf`.

### Revocacion real server-side

`requireAuth` compara:

- `sessionVersion` dentro del JWT
- contra `users.session_version` en DB.

Si no coincide: `401 Session is no longer valid`.

## CSRF y Origin protection

### CSRF (double-submit)

Para `POST/PUT/PATCH/DELETE` autenticados:

- request debe tener cookie de sesion;
- debe tener cookie CSRF (`blf_csrf`);
- debe incluir header `X-CSRF-Token`;
- header y cookie deben coincidir.

Excepciones CSRF:

- `/api/auth/login`
- `/api/auth/register`

### Origin check (hardening)

Para `POST/PUT/PATCH/DELETE` autenticados:

- en `production`: si falta `Origin` o no pertenece a `ALLOWED_ORIGINS`, responde `403`;
- en `development/test`: no bloquea por Origin (DX local).

## Rate limiting actual

Persistente en DB (no memoria por instancia), via `auth_rate_limits`.

- Login:
  - identidad: 5 intentos por 15 minutos
  - IP: 15 intentos por 15 minutos
- Register:
  - email: 5 intentos por 60 minutos
  - IP: 10 intentos por 60 minutos

En tests se usa fallback en memoria (`resetRateLimitsForTests`).

## Security headers aplicados

Desde `withApiRoute` y `middleware`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` base para frame blocking
- `Strict-Transport-Security` en produccion

## Logging y auditoria de auth

Eventos auditables ya implementados:

- `auth_login_succeeded`
- `auth_login_failed`
- `auth_register_succeeded`
- `auth_register_blocked_rate_limit`
- `auth_csrf_rejected`
- `auth_origin_rejected`
- `auth_session_revoked`
- `auth_logout_succeeded`

Campos relevantes: `correlation_id`, `route`, `method`, `user_id`, `ip`,
`reason` segun evento.

## Implementacion frontend (para tu companero)

El frontend debe usar el cliente central:

- `apps/web/lib/api/auth-client.ts`

No usar `fetch` auth suelto en componentes si se puede evitar, porque:

- el cliente ya manda `credentials: "include"`;
- agrega `X-CSRF-Token` en mutaciones;
- convierte errores al formato `ApiClientError`;
- redirige a login en expiracion/revocacion sobre `/api/auth/me`.

### Funciones disponibles

- `register(payload)`
- `login(payload)`
- `logout()`
- `getCurrentUser()`
- `updateCurrentUser(payload)`
- `listAdminUsers()`
- `updateAdminUserRole(id, payload)`

### Reglas concretas de integracion frontend

1. Usar siempre las funciones de `auth-client` para auth y admin users.
2. No guardar JWT en `localStorage` ni `sessionStorage`.
3. Considerar la cookie de sesion como unica fuente de autenticacion.
4. No recalcular permisos en frontend: usar `user.role` del backend.
5. Para vistas protegidas, manejar `401/403` redirigiendo a `/login`.
6. Al logout exitoso, navegar a `/login`.

### Ejemplo de uso recomendado

```ts
import { getCurrentUser, login, logout } from "@/lib/api/auth-client";

const user = await getCurrentUser();
await login({ emailOrUsername, password });
await logout();
```

## Flujo local recomendado (paso a paso)

1. Setear `.env` con `DATABASE_URL`, `AUTH_JWT_SECRET`, admin vars.
2. Correr migraciones:
   - `node scripts/dev/run-migrations.mjs`
3. Crear admin:
   - `node scripts/dev/create-admin-user.mjs`
4. Levantar app:
   - `pnpm dev` (o script del repo).
5. Probar:
   - register/login;
   - `/api/auth/me`;
   - update perfil;
   - admin users (con admin);
   - logout.

## Troubleshooting local (muy importante)

### Error: `CSRF token is missing or invalid`

Suele pasar por cookies desalineadas entre origenes (`localhost` vs `127.0.0.1`)
o sesion vieja sin cookie CSRF.

Checklist:

1. Borrar `blf_session` y `blf_csrf` en todos los hosts locales.
2. Usar un solo host (`localhost`) de punta a punta.
3. Re-login para regenerar ambas cookies.
4. Verificar en Network que `POST` mutantes llevan `X-CSRF-Token`.

### Sigo logueado pero logout falla

Normalmente logout fue rechazado por CSRF/Origin y no pudo limpiar cookies ni
revocar sesion. Revisar response `403` y su mensaje exacto.

## Preparacion para Vercel (pre-deploy)

Antes de deploy:

1. Definir en Vercel todos los env vars de auth y DB.
2. `APP_ENV=production`.
3. `DATABASE_URL` con `sslmode=verify-full`.
4. `ALLOWED_ORIGINS` con el/los origin(s) reales del frontend.
5. `AUTH_JWT_SECRET` fuerte (32+ chars random).
6. Correr migraciones sobre la DB de destino antes de habilitar trafico.

## Checklist de salida a produccion

- [ ] Migraciones `007/008/009` aplicadas en DB destino.
- [ ] Login, me, update profile, admin role update, logout funcionando.
- [ ] CSRF bloquea requests mutantes sin header/token correcto.
- [ ] Origin check bloquea origen no permitido en production.
- [ ] Rate limit devuelve `429` en intentos excesivos.
- [ ] Eventos de auditoria visibles en logs.
- [ ] Cookies correctas en prod (`Secure`, HttpOnly para sesion).

## Nota de mantenimiento

Si se cambia cualquier nombre de cookie (`AUTH_COOKIE_NAME` o
`AUTH_CSRF_COOKIE_NAME`), actualizar tambien el cliente frontend para leer la
cookie CSRF correspondiente (actualmente `blf_csrf` en `auth-client.ts`).
