# Studio: web + exportación móvil

## Flujo

1. **Crear** proyecto en `/projects` (scaffold React + Vite mobile-first).
2. **Diseñar** en `/studio` con chat Gemini y Spec-Kit.
3. **Preview** vía `/api/projects/:id/preview` o URL Vercel tras publicar.
4. **Publicar web** (Publish → Web → Deploy Vercel).
5. **Móvil** (Publish → Mobile): scan → corregir con IA → generar zip Capacitor.

## Capacitor

- **Modo remoto** (`server.url`): la app nativa carga la URL publicada (OTA de contenido).
- **Modo empaquetado** (`webDir: dist`): build Vite local + `npx cap sync`.

## APIs

| Ruta | Descripción |
|------|-------------|
| `GET /api/projects/:id/preview` | HTML del proyecto para iframe |
| `GET /api/projects/:id/validate-deploy` | Validación pre-deploy |
| `POST /api/projects/:id/mobile/scan` | Scan readiness |
| `POST /api/projects/:id/mobile/build` | Zip Capacitor (plan Starter+) |
| `GET/PUT /api/projects/:id/mobile/config` | Bundle IDs |

## Migración DB

Aplicar `supabase/migrations/016_studio_mobile.sql`.

## Tiendas

El usuario necesita cuentas Apple Developer y Google Play propias. Runlabs42 entrega el proyecto Capacitor; la submission es manual en Xcode / Android Studio.
