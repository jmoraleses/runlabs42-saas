# Revisión del proyecto — Runlabs42 (`SPEC-CLI/web`)

> Auditoría de código y arquitectura. Documento accionable: qué cambiaría y por qué.
> Fecha: 2026-05-18 · Stack: Next.js 14.2 (App Router) · React 18 · TypeScript 5 · Supabase · Stripe · Anthropic SDK · Sentry.

---

## 1. Resumen ejecutivo

El proyecto está **en buen estado base**: TypeScript en modo `strict` con `noUncheckedIndexedAccess`, headers de seguridad configurados (`vercel.json`, `next.config.mjs`), Sentry integrado, sin TODO/FIXME pendientes y secretos correctamente fuera de git.

Los cuatro cambios de mayor impacto, por orden de prioridad:

1. **Eliminar el manejo de errores silencioso** — varios `catch` tragan excepciones sin loggear, lo que hace imposible diagnosticar fallos en producción pese a tener Sentry disponible.
2. **Unificar la validación de entrada con Zod** — hoy conviven validación con esquema y coerción manual (`String()`/`Boolean()`), inconsistente y propensa a errores.
3. **Cubrir con tests el flujo de créditos/pagos** — la lógica de negocio crítica (Stripe, créditos) no tiene ningún test.
4. **Accesibilidad e imágenes** — no se usa `next/image` ni atributos `alt`.

> Nota: el hallazgo habitual de "credenciales expuestas en `.env.local`" **NO aplica aquí**. Verificado: el archivo está en `.gitignore`, no está trackeado y nunca estuvo en el historial de git. Solo se versiona `.env.local.example` (correcto).

---

## 2. Hallazgos priorizados

| Prioridad | Problema | Archivo:línea | Por qué importa | Cambio propuesto |
|---|---|---|---|---|
| 🔴 Alta | `catch` sin logging | `src/app/api/visual-edit/apply/route.ts:56` | 500 genérico; un fallo real es invisible en producción | Capturar a Sentry y devolver mensaje útil |
| 🔴 Alta | Error de fetch tragado | `src/hooks/useProjectFiles.ts:35` | Si la carga de archivos falla, el usuario ve un archivo vacío sin saber por qué (riesgo de pérdida de trabajo percibida) | Distinguir "sin archivos" de "error de carga"; exponer estado de error a la UI |
| 🟡 Media | Validación inconsistente | `src/app/api/projects/[id]/route.ts:35-39`, `src/app/api/projects/route.ts:49-56` | Coerción manual sin validar longitud/contenido frente a Zod en otras rutas | Esquemas Zod compartidos para todos los payloads de API |
| 🟡 Media | Cobertura de tests casi nula | `tests/` (solo 2 E2E) | Lógica de créditos/Stripe sin red de seguridad | Tests unitarios de `lib/` + tests de rutas API críticas |
| 🟡 Media | Sin `next/image` ni `alt` | global | Peor SEO, LCP y accesibilidad | Migrar `<img>` a `next/image` con `alt` |
| 🟢 Baja | `dangerouslySetInnerHTML` | `src/app/layout.tsx:54` | Seguro hoy (contenido interno), pero sin documentar | Añadir comentario justificando el porqué |

---

## 3. Detalle por área

### 3.1 Manejo de errores (Alta)

Existen `catch` que ocultan fallos. Los dos relevantes:

- **`src/app/api/visual-edit/apply/route.ts:56`** — `catch {}` sin parámetro: cualquier excepción se convierte en un 500 genérico sin traza. Con Sentry ya integrado, esto es información perdida.
- **`src/hooks/useProjectFiles.ts:35`** — un fallo de red al cargar archivos del proyecto se resuelve silenciosamente con un archivo por defecto vacío. El usuario no puede distinguir "proyecto nuevo" de "error de carga".

**Matiz:** el `catch` en `src/lib/ai/stream.ts:54-57` **sí es correcto** — es un fallback intencional (el payload puede ser un número plano en vez de JSON). No requiere cambio; sirve como ejemplo del patrón bien aplicado.

**Cambio propuesto:** en los `catch` que representan errores reales, loggear con `Sentry.captureException(e)` y propagar un estado de error a la UI o un mensaje específico en la respuesta de la API.

### 3.2 Validación de entrada (Media)

Conviven dos enfoques:

- **Correcto:** `src/app/api/visual-edit/apply/route.ts` valida el body con un esquema Zod (`safeParse`).
- **Frágil:** `src/app/api/projects/[id]/route.ts:35-39` y `src/app/api/projects/route.ts:49-56` hacen `String(body.name).trim()` / `Boolean(body.public)` sin validar longitud, formato ni el campo `description`. La coerción nunca falla, así que entra basura a la base de datos.

**Cambio propuesto:** definir esquemas Zod en un módulo compartido (p. ej. `src/lib/validation/`) y aplicarlos en todas las rutas de API. Unifica el patrón y da errores 400 claros.

### 3.3 Cobertura de tests (Media)

Solo existen 2 tests E2E (`tests/e2e/auth.spec.ts`, `smoke.spec.ts`). No hay unit tests sobre los ~92 archivos TS/TSX, ni cobertura de rutas API, Stripe o la lógica de créditos.

**Cambio propuesto, por prioridad:**
1. Tests unitarios de la lógica de créditos y prompts en `src/lib/`.
2. Tests de las rutas API de pagos y proyectos (incluido el webhook de Stripe y la deducción idempotente de créditos).
3. Ampliar E2E al flujo crítico: crear proyecto → consumir crédito → recarga.

### 3.4 Accesibilidad y SEO (Media)

No hay usos de `next/image` ni de atributos `alt` en el código. Esto penaliza LCP/CLS, el SEO de imágenes y la accesibilidad.

**Cambio propuesto:** migrar imágenes a `next/image` (optimización automática + `alt` obligatorio) y revisar HTML semántico en las páginas de marketing. Lo positivo: `src/app/layout.tsx` ya gestiona bien metadata, Open Graph, Twitter cards y `robots` según `isSitePublic()`.

### 3.5 Seguridad (Informativo — sin acción urgente)

- `.env.local` correctamente ignorado y nunca versionado. ✅
- **Recomendación:** verificar que la `service_role` key de Supabase solo se importe en `src/lib/supabase/server.ts` y `admin.ts`, nunca en `client.ts` ni en componentes con `'use client'`. Documentar el procedimiento de rotación de claves.

### 3.6 Calidad / menor

- `src/app/layout.tsx:54` — `dangerouslySetInnerHTML` para el script de tema anti-flash: contenido estático interno, seguro. Añadir un comentario de una línea explicando por qué es seguro.
- `src/lib/utils.ts` — `any[]` en `debounce`/`throttle`: aceptable para wrappers genéricos; sin acción.
- **Positivos a mantener:** `tsconfig` con `strict` + `noUncheckedIndexedAccess`, sin TODO/FIXME, headers de seguridad en `vercel.json`/`next.config.mjs`, separación correcta de clientes Supabase (browser/server/admin).

---

## 4. Roadmap recomendado

1. **Manejo de errores + Sentry** (Alta, esfuerzo bajo) — mayor retorno inmediato en observabilidad.
2. **Validación Zod unificada** (Media, esfuerzo medio) — endurece la frontera de la API.
3. **Tests de pagos/créditos** (Media, esfuerzo medio) — protege la lógica de negocio que genera ingresos.
4. **Accesibilidad / `next/image`** (Media, esfuerzo medio) — mejora SEO y rendimiento percibido.
