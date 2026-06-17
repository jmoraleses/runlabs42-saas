# Pendientes — Runlabs42 Web

> Fuente viva de lo que falta **implementar** y **pulir** en la plataforma web.  
> **Última revisión:** 2026-05-18 · Ramas de referencia: `preview`, `main`  
> **Commit de referencia:** `1d0783f` (layout suscripción / marketplace simplificado)

---

## Cómo usar este documento

| Símbolo | Significado |
|---------|-------------|
| **P0** | Bloquea producto o producción |
| **P1** | Importante para coherencia o confianza del usuario |
| **P2** | Pulido, accesibilidad, i18n, DX |
| `[ ]` | Pendiente |
| `[~]` | Parcial (existe código pero incompleto o mock) |
| `[x]` | Hecho (no reabrir salvo regresión) |

**Documentos relacionados (no duplicar aquí en detalle):**

- [REVIEW.md](../REVIEW.md) — auditoría técnica (errores silenciosos, tests, Zod)
- [.specify/specs/web-platform/tasks.md](../.specify/specs/web-platform/tasks.md) — checklist histórico Spec-Kit (desalineado)
- [DEVELOPMENT.md](../DEVELOPMENT.md) — desarrollo local
- [docs/DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) — despliegue
- [uploads/08-roadmap-desarrollo.md](../uploads/08-roadmap-desarrollo.md) — visión largo plazo (8 semanas)

---

## Resumen ejecutivo

**Hoy funciona bien** para explorar la UI: auth OAuth, ajustes (perfil, integraciones, suscripción con gráfico de créditos), marketplace legible, editor Monaco con preview visual por iframe, checkout Stripe (con env) y APIs de proyecto/marketplace sobre Supabase.

**Modo demo** (`enableDemo()` en `src/lib/auth/demo.ts`) da una cuenta local sin Supabase: proyectos y perfil en `localStorage`, integraciones simuladas y sin compras reales. Tras los guards `shouldUseDemoData()`, la suscripción ya no dispara 401 en transacciones; el chat y el marketplace de pago **siguen** llamando APIs que pueden fallar sin sesión real.

**Los cinco gaps que más retrasan un lanzamiento creíble:**

1. **IA real** — Gemini cableado con `GEMINI_API_KEY`; mock si no hay clave.
2. **Entrada a proyectos** — no hay listado post-login; `/dashboard` redirige a `/`.
3. **Reset de contraseña** — página existe pero rutas no cableadas.
4. **Marketplace vs copy** — se promete fork GitHub; solo hay metadata y créditos en DB.
5. **Calidad operativa** — errores tragados, casi sin tests de pagos/créditos, E2E requiere browsers de Playwright.

---

## Completado recientemente (no reabrir)

- [x] Suscripción unificada en Ajustes (`src/views/SettingsPage.jsx`, `src/components/billing/CreditUsagePanel.tsx`)
- [x] Marketplace simplificado para usuarios no técnicos (`src/views/MarketplacePage.jsx`, claves `mp.*` en `src/i18n.js`)
- [x] Redirección `/credits` y `/dashboard` → settings / home (`src/components/app/SpecKitApp.tsx`)
- [x] Guards demo: `shouldUseDemoData()` — evita 401 en `/api/user/transactions` y compras marketplace en demo
- [x] Sandbox del preview: `allow-scripts allow-forms` sin `allow-same-origin` (`src/components/editor/PreviewFrame.tsx`)
- [x] Layout actividad de créditos: título fuera del recuadro; subtítulo + métricas + gráfico dentro de `.credit-activity-card`
- [x] Script `npm run dev:clean` (`scripts/dev-clean.sh`, puerto 3010)

---

## Mapa rápido: demo vs producción

| Área | Modo demo (local) | Usuario autenticado (Supabase) |
|------|-------------------|--------------------------------|
| Perfil / proyectos demo-* | `localStorage` | API `projects`, `users` |
| Integraciones UI | Toggle local | APIs Supabase/Vercel + OAuth |
| Gráfico créditos / transacciones | Datos sintéticos, sin API | API si hay sesión |
| Comprar créditos (Stripe) | Bloqueado con mensaje | `POST /api/checkout` |
| Catálogo marketplace | `GET /products` (público) | Igual |
| Comprar / publicar marketplace | Puede 401 o fallar | DB + créditos |
| Chat IA (`/api/stream`) | Mock o Gemini | Gemini + créditos |
| Visual edit API | Mock (todos) | Mock (todos) |

Definición: `src/lib/auth/demo.ts` — `isDemoActive()`, `shouldUseDemoData(profile)`.

---

## P0 — Bloqueadores de producto

### P0.1 — IA real (stream)

| | |
|---|---|
| **Estado** | `[x]` Gemini + mock; Spec-Kit en stream si toggle activo |
| **Archivos** | `src/app/api/stream/route.ts`, `src/lib/ai/geminiStream.ts` |

### P0.2 — Mis proyectos / entrada al editor

| | |
|---|---|
| **Estado** | `[x]` `/projects` + redirect `/dashboard` → `/projects` |
| **Archivos** | `src/views/ProjectsPage.jsx`, `src/components/app/SpecKitApp.tsx` |

### P0.3 — Recuperación de contraseña

| | |
|---|---|
| **Estado** | `[~]` Componente huérfano |
| **Archivos** | `src/views/AuthResetPage.jsx`, `src/components/app/SpecKitApp.tsx` (rutas `/auth/reset*` → `AuthPage` signin) |
| **Hecho cuando** | Flujo solicitar email + enlace + confirmación nueva contraseña operativo con Supabase Auth |

### P0.4 — Errores silenciosos

| | |
|---|---|
| **Estado** | `[ ]` |
| **Archivos** | `src/hooks/useProjectFiles.ts` (~L35), `src/app/api/visual-edit/apply/route.ts` (~L56) |
| **Referencia** | [REVIEW.md](../REVIEW.md) §3.1 |
| **Hecho cuando** | `Sentry.captureException` en fallos reales; UI distingue «sin archivos» vs «error de carga»; API devuelve mensaje útil |

---

## P1 — Funcionalidad prometida vs implementada

### Marketplace

| Ítem | Estado | Archivos | Criterio de hecho |
|------|--------|----------|-------------------|
| Publicar con repo real | `[~]` | `src/views/MarketplacePage.jsx` (`PublishModal`, repo fijo `acme/pricing-page`) | Selector de repo GitHub del usuario o input validado |
| Compra con fork/transfer | `[ ]` | `src/app/api/marketplace/purchase/route.ts` | Comportamiento documentado implementado o copy actualizado |
| Importar clona código | `[~]` | `src/app/api/marketplace/import/route.ts` | Import crea proyecto con archivos reales o se renombra feature a «abrir en editor» |
| Copy vs realidad | `[ ]` | `src/i18n.js` (`mkt.*`), `src/views/LandingPage.jsx` | Sin prometer fork/ZIP/transfer si no existe |
| Demo: compras sin 401 confuso | `[~]` | `MarketplacePage.jsx`, `demo.ts` | Bloquear CTA con mensaje o omitir llamada API en demo |

### Editor y edición visual

| Ítem | Estado | Archivos | Criterio de hecho |
|------|--------|----------|-------------------|
| Preview del código del proyecto | `[ ]` | `public/visual-edit/preview.html`, `bridge.js` | Preview refleja spec/código del proyecto activo |
| Parche visual persistente | `[~]` | `src/app/api/visual-edit/apply/route.ts`, `src/lib/visual-edit/` | Dejar de devolver `mode: 'mock'`; persistir o aplicar en AST |
| Publicar en GitHub | `[ ]` | `src/views/EditorPage.jsx` | Botón conectado a API o flujo OAuth |
| Layout spec (3 paneles) | `[~]` | `src/views/EditorPage.jsx` | `DiffView`, `TabBar`, preview dedicados según spec |
| Chat tras edición visual | `[~]` | `src/components/editor/AIChatPanel.tsx` | Usa stream real cuando P0.1 esté hecho |

### Billing / Stripe

| Ítem | Estado | Archivos | Criterio de hecho |
|------|--------|----------|-------------------|
| Webhook créditos | `[~]` | `src/app/api/webhooks/stripe/route.ts` | Con `SUPABASE_SERVICE_ROLE_KEY`, créditos se acreditan; probado en staging |
| Packs UI vs Stripe | `[~]` | `src/views/SettingsPage.jsx`, `src/lib/stripe/config.ts` | Precios e IDs alineados |
| Historial transacciones | `[x]` UI | `SettingsPage.jsx` `BillingSection` | Lista con API en cuenta real; copy amigable en demo (P2) |
| Tests pagos | `[ ]` | `tests/` | Unit o integration: webhook idempotente, deducción créditos |

### Ajustes (Settings)

| Ítem | Estado | Archivos | Criterio de hecho |
|------|--------|----------|-------------------|
| Tab Security | `[ ]` | `src/views/SettingsPage.jsx` | Contraseña, sesiones, 2FA si aplica |
| Tab API Keys | `[ ]` | `src/app/api/user/api-keys/route.ts`, Settings | CRUD de keys en UI |
| Plan Enterprise | `[~]` | `src/views/PricingPage.jsx` | CTA contacto o página enterprise |

### Modo demo — coherencia

| Ítem | Estado | Criterio de hecho |
|------|--------|-------------------|
| Sin llamadas API innecesarias | `[~]` | Stream, compra y publish en demo no generan 401 en consola |
| Mensaje único «cuenta demo» | `[~]` | CTAs que requieren cuenta real muestran el mismo patrón de copy |
| Documentar en DEVELOPMENT | `[ ]` | Qué hace el botón Demo en `shell.jsx` |

---

## P1 — Calidad e infraestructura

Basado en [REVIEW.md](../REVIEW.md) y estado del repo.

| Ítem | Estado | Archivos / notas | Criterio de hecho |
|------|--------|------------------|-------------------|
| Validación Zod unificada | `[ ]` | `src/app/api/projects/route.ts`, `projects/[id]/route.ts` | Esquemas compartidos en `src/lib/validation/` |
| Tests unitarios créditos/stream | `[ ]` | `src/lib/**/__tests__/` (hoy ~4 archivos) | Cobertura de lógica crítica de negocio |
| Tests E2E ejecutables | `[~]` | `tests/e2e/`, `playwright.config` | `npx playwright install` documentado; smoke verde en CI |
| E2E flujos críticos | `[ ]` | Nuevos specs | settings/billing, crear proyecto, auth completo |
| PostHog / analytics | `[ ]` | `src/lib/analytics/posthog.tsx` | Integración real o eliminar placeholder |
| Imágenes y SEO | `[ ]` | Vistas marketing | `next/image` + `alt` |
| Sentry en todos los catch | `[~]` | APIs y hooks | Sin `catch {}` vacíos en rutas críticas |

**Arquitectura (deuda documentada):** la app usa SPA client-side (`src/components/app/SpecKitApp.tsx` + `src/app/[[...slug]]/page.tsx`), no las carpetas `(marketing)/(app)` del plan original en tasks.md. No es bug; conviene mantener esta nota al añadir rutas nuevas.

---

## P2 — Pulido UX / UI / DX

| Ítem | Estado | Notas |
|------|--------|-------|
| i18n marketplace `mp.*` en fr/de/nl/it | `[ ]` | Hoy fallback a `en` |
| Mensajes «solo preview» en editor | `[~]` | `src/components/editor/ElementInspector.tsx` |
| `dev:clean` en DEVELOPMENT | `[ ]` | Caché `.next`, error `Cannot find module './682.js'` |
| Accesibilidad gráfico créditos | `[ ]` | Roles, labels en barras |
| Accesibilidad tabs Ajustes | `[ ]` | Navegación teclado |
| Empty states demo (historial, compras) | `[ ]` | Copy en español claro |
| Puerto dev 3010 vs 3000 | `[x]` | `package.json` `dev` script |

---

## Visión largo plazo (solo referencia)

No expandir aquí el roadmap de 8 semanas. Ver:

- `uploads/05-plataforma-web.md` — editor, colaboración, versiones
- `uploads/06-marketplace-stripe.md` — marketplace y pagos
- `uploads/09-funciones-alto-valor.md` — features premium

Priorizar siempre **P0 → P1** de este archivo antes de nuevas features del folder `uploads/`.

---

## Checklist pre-release

Usar antes de merge a producción o tag:

- [ ] Variables en Vercel: Supabase URL/keys, Stripe, `SUPABASE_SERVICE_ROLE_KEY`, OAuth
- [ ] SQL aplicado: `supabase/apply-all.sql` (o migraciones 001–011)
- [ ] `npm run build` sin errores
- [ ] `npm run test` pasa
- [ ] `npx playwright install` + `npm run test:e2e` smoke verde
- [ ] `/settings?tab=billing` en demo: sin 401 en consola
- [ ] Checkout Stripe en staging con webhook de prueba
- [ ] Revisar que copy de landing/marketplace no prometa lo no implementado

---

## Mantenimiento de este archivo

1. Al cerrar un ítem, marcar `[x]` y fecha breve en «Completado recientemente» si es relevante.
2. No marcar las 81 tareas de `tasks.md` en bloque; ese archivo queda como archivo histórico Spec-Kit.
3. Para auditorías técnicas profundas, seguir actualizando [REVIEW.md](../REVIEW.md) y enlazar desde aquí.
