# Estrategia de preview en Studio

## Dos caminos

| Camino | Cuándo | Endpoint / módulo |
|--------|--------|-------------------|
| **Cliente (principal)** | Edición en vivo en `/studio` con archivos en buffers | `POST /api/preview/bundle` → [`bundleProject.ts`](../src/lib/preview/bundleProject.ts) |
| **Servidor** | Proyecto sin archivos locales en workspace (solo `?project=` remoto) o tras publicar | `GET /api/projects/:id/preview` |

En Studio, si hay archivos en el workspace se usa siempre el bundle cliente (iframe vía [`ProjectPreviewFrame`](../src/components/editor/ProjectPreviewFrame.tsx)).

## Debounce y caché

- El iframe recompila **600 ms** después del último cambio de archivos (`filesKey` hash del contenido).
- Timeout de bundle: 90 s; abort si el usuario cambia archivos antes.

## Stubs CDN

Librerías sin resolución npm en el bundler (p. ej. `recharts`, `framer-motion`) se sustituyen por stubs. La API devuelve `stubPackages[]` y el preview muestra un aviso **“Preview aproximado”**.

## Errores

- **Compilación esbuild**: overlay rojo + panel Problemas + autofix IA (hasta 4 intentos).
- **Runtime en iframe**: consola + callback `onCompileError` (mismo pipeline de autofix).

## Monaco

Validación **sintáctica** opcional (`localStorage` clave `studio_monaco_syntax`, por defecto activa). La semántica TS sigue desactivada; el preview es la fuente de verdad para runtime.
