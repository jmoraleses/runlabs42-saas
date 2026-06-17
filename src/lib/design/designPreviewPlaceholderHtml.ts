import {
  designLoadingGradientMarkup,
  getDesignLoadingGradientCss,
} from '@/lib/design/designLoadingGradient'

export { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'

/** HTML mínimo mientras aún no existe el mockup/HTML — aurora azul (no fondo gris). */
export function designPreviewPlaceholderHtml(lang = 'es'): string {
  const title = lang.startsWith('es') ? 'Diseñando' : 'Designing'
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${getDesignLoadingGradientCss()}
html, body { height: 100%; margin: 0; overflow: hidden; }
body { position: relative; }
</style>
</head>
<body>
${designLoadingGradientMarkup()}
</body>
</html>`
}
