# Runlabs42 Web — Desarrollo local

**Pendientes de implementación y pulido:** [docs/PENDIENTES.md](docs/PENDIENTES.md)

## Requisitos

- Node.js 20+
- Cuenta Supabase (proyecto `uqawltpguhjnkioqeqsh` o el tuyo)
- Opcional: Stripe para checkout

## Configuración

1. Copia `.env.example` a `.env.local`
2. Aplica SQL: `supabase/apply-all.sql` en el SQL Editor de Supabase
3. OAuth: ver `supabase/OAUTH-SETUP.md`
4. `npm install && npm run dev`

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3010) |
| `npm run dev:clean` | Mata `next dev`, borra `.next` y reinicia (si falla con `682.js` o MIME 500) |
| `npm run build` | Build de producción |
| `npm run test` | Vitest unitarios |
| `npm run test:e2e` | Playwright E2E |

## Flujos principales

- **Auth:** GitHub/Google → `/auth/callback?next=`
- **Proyectos:** `POST /api/projects` → editor con `?project=id`
- **Archivos:** `GET/PUT /api/projects/[id]/files`
- **IA:** mock en `POST /api/stream` (sin Anthropic/DeepSeek)
- **Créditos:** Stripe checkout + webhook `anadir_creditos`

## Manual en dashboard

- Bucket Storage `avatars` (público) para subir avatar
- Productos/precios Stripe en env: `STRIPE_PRICE_*`
- `SUPABASE_SERVICE_ROLE_KEY` para deducir créditos en stream
