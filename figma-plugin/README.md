# Plugin Figma — Runlabs42

Importa bundles generados desde Web Studio (`POST /api/projects/[id]/design/figma/export`).

## Desarrollo

1. En Figma Desktop: **Plugins → Development → Import plugin from manifest…**
2. Selecciona `figma-plugin/manifest.json`.
3. En la web: **Exportar a Figma** → copia `exportId`, `projectId`, `token` y la URL base de la app.
4. Pega los valores en el plugin y pulsa **Importar diseño**.

## Build (opcional)

Compila `code.ts` a `code.js` con el CLI de Figma o `tsc` si añades `@figma/plugin-typings`.
