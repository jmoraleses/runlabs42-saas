# Runlabs42 — Supabase `uqawltpguhjnkioqeqsh`

## URLs de este proyecto

| Uso | URL |
|-----|-----|
| API / App | `https://uqawltpguhjnkioqeqsh.supabase.co` |
| OAuth callback (GitHub/Google) | `https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback` |
| Dashboard SQL | [SQL Editor](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/sql/new) |
| Auth providers | [Providers](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/providers) |
| URL config | [URL Configuration](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/url-configuration) |

## Vercel (plataforma Runlabs42 — solo preview hasta lanzamiento)

- Los pushes van a la rama **`preview`** (no a `main`). `main` no dispara deploy (ver `vercel.json`).
- **`https://runlabs42.vercel.app` no se actualiza solo** hasta cambiar Production Branch a `preview` en Vercel → Settings → Git, o ejecutar `npm run vercel:sync-production` tras cada push. Detalle: [`docs/DEPLOY-VERCEL.md`](../docs/DEPLOY-VERCEL.md).
- **No uses `vercel --prod`** hasta el lanzamiento público (salvo sync de arriba).
- Despliega preview: `npm run vercel:preview` (equivale a `vercel`).
- Variables recomendadas (Preview + Development):
  - `NEXT_PUBLIC_SITE_PUBLIC` = `false` (o sin definir)
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://uqawltpguhjnkioqeqsh.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → configurada
  - `SUPABASE_SERVICE_ROLE_KEY` → service_role de este proyecto (metadatos plataforma)
  - `INTEGRATIONS_ENCRYPTION_KEY` → string aleatorio ≥32 caracteres (cifra tokens Vercel/Supabase de usuarios)

Al lanzar: `NEXT_PUBLIC_SITE_PUBLIC=true` solo en Production y entonces `vercel --prod`.

## Integraciones por usuario (BYO)

Cada usuario conecta **su** Supabase y **su** Vercel en Ajustes → Integraciones.

1. Usuario crea proyecto en [supabase.com](https://supabase.com) (plan gratis).
2. Ejecuta `supabase/user-project-schema.sql` en su SQL Editor.
3. Pega URL + anon + service_role en Runlabs42.
4. Crea token en [vercel.com/account/tokens](https://vercel.com/account/tokens) y conéctalo.

Los archivos del editor se guardan en el Supabase del usuario; el marketplace y proyectos usan metadatos en la plataforma.

## 1. Migraciones (una vez)

En [SQL Editor](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/sql/new), pega y ejecuta todo el archivo:

`supabase/apply-all.sql`

## 2. Solo OAuth (sin email)

1. [Providers](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/providers) → **Email** = OFF  
2. **GitHub** = ON (+ Client ID/Secret) → ver `OAUTH-SETUP.md`  
3. **Google** = ON (opcional)

## 3. URL Configuration

| Campo | Valor |
|-------|--------|
| Site URL | `https://www.runlabs42.com` |
| Redirect URLs | `https://www.runlabs42.com/auth/callback` |
| | `https://runlabs42.com/auth/callback` |
| | `https://runlabs42.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

## 4. Probar

https://www.runlabs42.com/auth/signup → **GitHub** o **Google**
