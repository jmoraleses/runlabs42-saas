# Activar GitHub y Google en Supabase

El error `Unsupported provider: provider is not enabled` significa que el proveedor **no está activado** en el panel de Supabase (no es un bug de la web).

## 1. Obtén tu URL de callback de Supabase

En Supabase → **Project Settings** → **API**, copia **Project URL**.  
Ejemplo: `https://abcdefgh.supabase.co`

La callback para OAuth es siempre:

```
https://TU-PROJECT-REF.supabase.co/auth/v1/callback
```

Sustituye `TU-PROJECT-REF` por el subdominio de tu proyecto.

---

## 2. URLs en Supabase (obligatorio)

**Authentication → URL Configuration**

| Campo | Valor |
|-------|--------|
| Site URL | `https://www.runlabs42.com` (o tu dominio principal) |
| Redirect URLs | `https://www.runlabs42.com/auth/callback` |
| | `https://runlabs42.com/auth/callback` |
| | `https://runlabs42.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |
| | `http://localhost:3010/auth/callback` |
| | `https://*.vercel.app/auth/callback` |

Tras cambiar de dominio (p. ej. de `*.vercel.app` a `runlabs42.com`), **añade las nuevas URLs**; si solo está la URL antigua, Google/GitHub fallan o vuelves a signin sin sesión.

Guarda los cambios.

---

## 3. GitHub

### A) Crear OAuth App en GitHub

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. **Application name:** Spec-Kit (o Runlabs42)
3. **Homepage URL:** `https://www.runlabs42.com`
4. **Authorization callback URL:**  
   `https://TU-PROJECT-REF.supabase.co/auth/v1/callback`  
   (la de la sección 1, **no** la de Vercel)
5. Crear app → copia **Client ID** y genera **Client Secret**

### B) Activar en Supabase

1. Supabase → **Authentication** → **Providers** → **GitHub**
2. **Enable GitHub** = ON
3. Pega **Client ID** y **Client Secret**
4. Guardar

---

## 4. Google

### A) Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto → **APIs & Services** → **Credentials**
2. Abre tu **OAuth 2.0 Client ID** (tipo **Web application**), por ejemplo:  
   `979348275233-8607h0oh34idb4nepgn0kkg04c5tur65.apps.googleusercontent.com`
3. **Authorized redirect URIs** — debe haber **solo** esta (sin barra final, sin dominio Runlabs42):

   ```
   https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback
   ```

4. Si cambiaste el secret, usa **Client Secret** nuevo (empieza por `GOCSPX-`).  
   **No** pegues el secret en Vercel ni en `GEMINI_API_KEY` (eso es otra API).

### B) Activar en Supabase

1. [Providers → Google](https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/providers)
2. **Enable Google** = ON
3. **Client ID:** el de Google Cloud (`…apps.googleusercontent.com`)
4. **Client Secret:** el `GOCSPX-…` de la misma credencial (sin espacios al copiar)
5. Guardar y esperar ~1 minuto

### C) Vercel (Runlabs42)

En **Production** y **Preview**:

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://www.runlabs42.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uqawltpguhjnkioqeqsh.supabase.co` |

Redeploy tras cambiar variables.

---

## 5. Comprobar

1. Espera ~1 minuto tras guardar en Supabase
2. Abre https://www.runlabs42.com/auth/signin
3. Pulsa **Continue with GitHub** o **Google**

**Runlabs42 solo permite registro con GitHub o Google.** Desactiva el proveedor **Email** en Supabase → Authentication → Providers.

---

## Errores frecuentes

| Error | Causa |
|-------|--------|
| `provider is not enabled` | Toggle del proveedor en OFF en Supabase |
| `redirect_uri_mismatch` | Callback en GitHub/Google no coincide con `...supabase.co/auth/v1/callback` |
| Vuelve a signin sin sesión | Falta la URL exacta del navegador en Redirect URLs (p. ej. `https://www.runlabs42.com/auth/callback`) |
| Google `redirect_uri_mismatch` | En Google Cloud, la URI autorizada debe ser solo `https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback` |
| `Unable to exchange external code: 4/0A` | Supabase no pudo canjear el código de Google. Revisa **Client ID y Secret** en Supabase → Providers → Google (copia de nuevo desde Google Cloud, sin espacios). El `4/0A` es el prefijo normal de un código de Google, no es el fallo en sí. |
| `code verifier` vacío | Mezcla www / sin www, incógnito, o falta la URL en Redirect URLs. Usa siempre `https://www.runlabs42.com` y añádela en Supabase. En Vercel: `NEXT_PUBLIC_APP_URL=https://www.runlabs42.com` |
