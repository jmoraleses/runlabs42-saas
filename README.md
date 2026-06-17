# runlabs42-saas

Aplicación SaaS basada en Next.js con Supabase como backend de datos y autenticación.

## Stack principal

- Next.js 14
- React 18
- Supabase (Auth + Postgres + migraciones SQL)
- Tailwind CSS

## Requisitos

- Node.js 20+
- pnpm

## Instalación y arranque

```bash
pnpm install
pnpm dev
```

Servidor local por defecto: `http://localhost:3010`.

## Variables de entorno

No se incluyen secretos en el repositorio. Usa como base:

- `.env.local.example`

Los archivos `.env*` reales están ignorados por git.

## Base de datos

Fuente oficial de esquema/migraciones:

- `supabase/migrations/`
- `supabase/apply-all.sql`
- `supabase/seed-marketplace.sql`

## Seguridad de publicación

Este repositorio ignora explícitamente:

- `.env*`
- `supabase/.temp/`
- `.kiro/`
- `.claude/`
