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

### Instalador interactivo (recomendado)

```bash
./install.sh
# o
pnpm setup
```

El script pregunta si quieres **local** (Supabase en Docker) o **producción** (Supabase en la nube), instala dependencias, genera `.env.local` y opcionalmente arranca el servidor.

### Manual

```bash
pnpm install
pnpm dev
```

Servidor local por defecto: `http://localhost:3010`.

## Variables de entorno

No se incluyen secretos en el repositorio. Usa como base:

- `.env.local.example`

Los archivos `.env*` reales están ignorados por git.

## Supabase local con Docker

Este proyecto puede correr contra Supabase local usando contenedores Docker (a través de Supabase CLI).

### 1) Requisitos

- Docker Desktop levantado
- Supabase CLI instalado

### 2) Inicializar/arrancar Supabase local

```bash
supabase init
supabase start
supabase status
```

`supabase start` levanta los servicios en Docker. Luego `supabase status` te muestra URL y claves locales.

### 3) Configurar variables locales

1. Copia el ejemplo:

```bash
cp .env.local.example .env.local
```

2. Rellena en `.env.local` los valores locales que imprime `supabase status` (anon key y publishable key).

Valores esperados para local:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_URL=http://127.0.0.1:54321`

### 4) Arrancar la app

```bash
pnpm dev
```

La configuración de CSP/imagenes ya permite `127.0.0.1:54321` y `localhost:54321` para no bloquear requests de Supabase local.

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
