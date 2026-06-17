# Despliegue en Vercel (Runlabs42)

## Configuración actual

| Rama | Auto-deploy (`vercel.json`) | Destino |
|------|-----------------------------|---------|
| `main` | **No** | Production solo con deploy manual |
| `preview` | **No** | Sin builds automáticos por Git |

Los pushes a GitHub **no** crean deploy. Publica cuando quieras:

```bash
npm run vercel:prod
# equivalente: npx vercel@latest deploy --prod
# o desde el dashboard de Vercel → Deployments → Redeploy
```

El CLI no está en `package.json` (evita el warning de Next.js al compilar). Usa `npx` o `npm i -g vercel` si prefieres el comando global.

**Dominios de producción:** `www.runlabs42.com`, `runlabs42.com` (apex redirige según DNS de Vercel).

**Nota:** En el dashboard de Vercel, comprueba que *Settings → Git → Deploy Hooks* no tenga reglas que ignoren `vercel.json`. Si sigue desplegando al push, desactiva “Automatic Deployments” ahí también.

## Ignored Build Step (por qué se cancela el deploy)

Si el log muestra:

```text
Running "if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi"
The Deployment has been canceled as a result of running the command defined in the "Ignored Build Step" setting.
```

**Causa:** En Vercel, **exit 0 = cancelar/ignorar el build** y **exit 1 = continuar el build**. El script del dashboard era:

```bash
if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi
```

En un deploy **preview** (`VERCEL_ENV=preview`) hace **exit 0** → Vercel **cancela** el deploy. El script estaba al revés de lo que necesitas.

**Solución (en el repo):** [`vercel.json`](../vercel.json) define `ignoreCommand` (sobrescribe el dashboard):

```json
"ignoreCommand": "bash scripts/vercel-should-build.sh"
```

Lógica de [`scripts/vercel-should-build.sh`](../scripts/vercel-should-build.sh):

| Rama | Exit | Efecto |
|------|------|--------|
| `main`, `preview` y demás | 0 | No construir (deploy manual: `npm run vercel:prod` o dashboard) |

**Dashboard (opcional):** Si sigue el comando antiguo, en Settings → Git → Ignored Build Step pon `bash scripts/vercel-should-build.sh` o déjalo vacío para usar solo `vercel.json`.

**Production Branch recomendada en Vercel:** `main` (no `preview`), para que los pushes a `preview` generen deployments de tipo **Preview** con URL `*.vercel.app`.

## Tras cada `vercel:prod`: enlazar dominios

El deploy manual crea una URL nueva (`runlabs42-xxxx.runlabs42.vercel.app`). Si `www.runlabs42.com` responde `404` con `x-vercel-error: DEPLOYMENT_NOT_FOUND`, suele ser una de estas causas:

1. **Dominio en otro proyecto Vercel** (muy frecuente al recrear el proyecto). El CLI lo confirma con:
   ```bash
   npx vercel@latest domains add www.runlabs42.com
   # → "already assigned to another project" (alias_conflict)
   ```
   **Solución:** [Dashboard → Domains](https://vercel.com/dashboard/domains) → abre `runlabs42.com` → quítalo del proyecto viejo → en el proyecto **runlabs42** → **Settings → Domains** → añade `runlabs42.com` y `www.runlabs42.com` a **Production**.

2. **Production URL vacía** en `vercel project ls` (`Latest Production URL: --`). Tras mover el dominio, haz **Redeploy** del último deploy Production Ready o `npm run vercel:prod`.

3. Alias manual a un deploy concreto (solo si el dominio ya pertenece al proyecto correcto).

### 1. Comprobar

```bash
curl -sI https://www.runlabs42.com | grep -E 'HTTP|x-vercel-error'
```

Si ves `DEPLOYMENT_NOT_FOUND`, sigue con el paso 2.

### 2. Dashboard (recomendado)

1. [Vercel → runlabs42 → Deployments](https://vercel.com/runlabs42/runlabs42) → último deploy **Production** con estado **Ready**
2. Menú **⋯** → **Assign domain** (o **Settings → Domains** y confirma que `runlabs42.com` y `www.runlabs42.com` apuntan a **Production**)
3. Repite `curl` hasta obtener **200** o **307** (sin `DEPLOYMENT_NOT_FOUND`)

### 3. CLI (opcional)

Sustituye `DEPLOY_URL` por la URL que imprime `npm run vercel:prod` (ej. `runlabs42-abc123-runlabs42.vercel.app`):

```bash
npx vercel@latest alias set DEPLOY_URL runlabs42.com -S runlabs42
npx vercel@latest alias set DEPLOY_URL www.runlabs42.com -S runlabs42
```

Si aparece *You don't have access to the domain*, usa el dashboard con la cuenta que registró el dominio en Vercel.

## Indexación (Google / robots)

Por defecto el sitio **no es indexable**:

- `robots.txt` → `Disallow: /` para todos los bots
- Cabecera `X-Robots-Tag: noindex, nofollow` en todas las páginas
- Metadatos `robots` en `layout.tsx` con `index: false`
- `sitemap.xml` vacío

Todo eso depende de **`NEXT_PUBLIC_SITE_PUBLIC`**: solo si vale exactamente `true` se permite indexar.

En Vercel → **Settings → Environment Variables** (Production):

- No añadas `NEXT_PUBLIC_SITE_PUBLIC`, o déjala en `false`
- Al lanzar al público: pon `NEXT_PUBLIC_SITE_PUBLIC=true` y vuelve a desplegar

## Verificar deploy y dominio

`vercel inspect` **no** acepta un dominio personalizado (`www.runlabs42.com`); solo una URL de deployment (`*.vercel.app`) o un ID `dpl_…`. Si usas el dominio, verás: *Can't find the deployment "www.runlabs42.com"*.

```bash
# Últimos deploys (copia la URL de Production Ready)
npx vercel@latest ls -S runlabs42

# Detalle de un deploy concreto (sustituye por la URL que salió arriba o en vercel:prod)
npx vercel@latest inspect runlabs42-xxxx-runlabs42.vercel.app -S runlabs42

# Estado del dominio público (no usa vercel inspect)
curl -sI https://www.runlabs42.com | grep -E 'HTTP|x-vercel-error|location'
```

Los avisos `EBADENGINE` (Node 25 vs dependencia del CLI) y `deprecated tar` al instalar `vercel` con `npx` son **warnings**, no el motivo del error anterior.

## Publicar sitios de usuario (cuenta Vercel Hobby)

Desde el editor → **Publicar**, Runlabs ejecuta `POST /api/projects/[id]/publish` (SSE):

1. Genera `spec/site-manifest.json` (páginas, formularios, enlaces).
2. Convierte diseño → **Next.js 14 App Router** (`app/`, plantilla en `templates/site-next/`).
3. Añade API `app/api/forms/{id}` y SQL en `drizzle/0001_init.sql`.
4. Valida `package.json` + `app/layout.tsx` + rutas API.
5. Despliega en la **cuenta Vercel del usuario** (OAuth en Ajustes → Integraciones).

El framework del proyecto Vercel se detecta como `nextjs` si `package.json` incluye `next`.

### Variables en el proyecto Vercel del usuario

| Variable | Uso |
|----------|-----|
| `POSTGRES_URL` | Vercel Postgres / Neon (formularios y datos) |
| `RESEND_API_KEY` | Fallback email si no hay Postgres |
| `CONTACT_TO_EMAIL` | Destino del formulario de contacto |

Puedes pegar `POSTGRES_URL` en el body del publish (`postgresUrl`) la primera vez; Runlabs la inyecta vía API de Vercel.

**Límites Hobby (orientativos):** invocaciones serverless mensuales acotadas, 1 proyecto por cuenta en algunos planes; revisa [Vercel Pricing](https://vercel.com/pricing).

### E2E local

```bash
BASE_URL=http://localhost:3010 PROJECT_ID=<uuid> SESSION_COOKIE="..." node scripts/e2e-publish-site.mjs
```

## Chat IA (Google AI Studio / Gemini)

El chat usa una **API key de AI Studio** (`AIza…`), no las credenciales OAuth de Google Cloud.

| Variable | Entornos | Valor |
|----------|----------|--------|
| `GEMINI_API_KEY` | Production, Preview, Development | Clave desde [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `AI_PROVIDER` | Igual | `gemini` |

**No** uses `NEXT_PUBLIC_` para la clave (solo servidor).

Tras añadir o cambiar variables: **Redeploy** de Production.

Comprobar:

```bash
curl -s https://www.runlabs42.com/api/health | jq '.checks.gemini, .checks.aiProvider'
```

Debe devolver `true` y `"gemini"`. En local: `http://localhost:3010/api/health`.

Local: pegar la clave en [`.env.local`](../.env.local) (gitignored), reiniciar `npm run dev`.

## OAuth (Google / GitHub) tras cambiar dominio

Si el sitio carga pero **Google no inicia sesión**, casi siempre faltan URLs en Supabase:

1. [URL Configuration](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/url-configuration)
2. **Site URL:** `https://www.runlabs42.com`
3. **Redirect URLs:** añade `https://www.runlabs42.com/auth/callback` y `https://runlabs42.com/auth/callback` (mantén localhost y `*.vercel.app` si los usas)
4. En Vercel → **Environment Variables** (Production): `NEXT_PUBLIC_APP_URL` = `https://www.runlabs42.com` y redeploy

Google Cloud Console: la URI autorizada sigue siendo solo  
`https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback` (no el dominio Runlabs42).  
Detalle: [`supabase/OAUTH-SETUP.md`](../supabase/OAUTH-SETUP.md).

## Lanzamiento público (futuro)

```bash
# En Vercel: NEXT_PUBLIC_SITE_PUBLIC=true (Production)
# Luego redeploy desde main
```
