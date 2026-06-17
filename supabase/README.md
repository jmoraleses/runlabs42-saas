# Supabase — Spec-Kit

## Aplicar migraciones

**Opción A — SQL Editor (rápido)**  
En [Supabase Dashboard](https://supabase.com/dashboard) → SQL → ejecuta en orden:

1. `migrations/001_users.sql`
2. `migrations/002_transactions.sql`
3. `migrations/003_projects.sql`
4. `migrations/004_marketplace.sql`
5. `migrations/005_rls.sql`
6. `migrations/006_functions.sql`
7. `migrations/007_triggers.sql`

**Opción B — CLI**

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

## Auth (Supabase + Vercel)

En **Authentication → URL Configuration**, añade:

- Site URL: `https://runlabs42.vercel.app`
- Redirect URLs:
  - `https://runlabs42.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

**Solo OAuth:** desactiva **Email** en Authentication → Providers (OFF).  
Habilita **GitHub** y **Google** (ON) con Client ID/Secret.

**Guía detallada:** `supabase/OAUTH-SETUP.md` (error `provider is not enabled` = proveedor no activado).

## Variables en Vercel

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
