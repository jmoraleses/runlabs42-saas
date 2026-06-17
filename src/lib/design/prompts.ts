import { aspectRatioFromPageDimensions } from '@/lib/ai/constants'
import type { CodeTemplate } from '@/lib/codeTemplates'
import {
  DESIGN_BREAKPOINT_PRESETS,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'

/** UI plana a pantalla completa para mockups PNG (Imagen 4). */
export const MOCKUP_FULL_BLEED_RULES_EN =
  'The PNG is the website UI itself (like a Figma artboard export), NOT a photo of a monitor or browser. Flat 2D web UI edge-to-edge (full bleed): content touches all four image borders. First pixel row = site header/nav, never OS or browser chrome. Forbidden: device frame, laptop/phone bezel, browser window, title bar, traffic-light buttons, tabs, address bar, URL bar, nested screenshot, UI floating on gray canvas, 3D perspective, Dribbble/Behance presentation mockup, monitor on desk.'

export const MOCKUP_PROMPT_PREFIX =
  'OUTPUT = flat web page UI artwork only (the page itself). NOT a browser window. NOT a screenshot inside another frame. '

export const MOCKUP_NEGATIVE_PROMPT =
  'browser window, browser chrome, browser frame, safari window, chrome browser, firefox window, address bar, url bar, omnibox, browser tabs, tab bar, macOS window controls, red yellow green dots, traffic light buttons, window title bar, window frame, nested window, screenshot inside screenshot, picture in picture, device mockup, phone frame, laptop mockup, tablet bezel, iPhone frame, MacBook mockup, monitor on desk, hands holding phone, 3d perspective, isometric, floating screen, gray background, grey background, letterboxing, white border around UI, drop shadow frame, presentation mockup, Dribbble shot, Behance mockup, Figma device preview, desktop wallpaper visible, OS desktop, menu bar'

/** Limpia frases del imagePrompt de Gemini que invitan a marcos de ventana. */
export function sanitizeImagePromptForMockup(prompt: string): string {
  return prompt
    .replace(/\bbrowser window\b/gi, 'web page layout')
    .replace(/\bbrowser chrome\b/gi, '')
    .replace(/\bin (?:a )?browser\b/gi, '')
    .replace(/\bweb browser\b/gi, 'web app')
    .replace(/\bwindow frame\b/gi, '')
    .replace(/\bviewport\b/gi, 'layout')
    .replace(/\bscreenshot\b/gi, 'flat UI')
    .replace(/\bscreen ?shot\b/gi, 'flat UI')
    .replace(/\bdevice mockup\b/gi, 'UI layout')
    .replace(/\bpresentation mockup\b/gi, 'UI layout')
    .replace(/\b(?:phone|laptop|tablet|desktop)\s+frame\b/gi, '')
    .replace(/\btraffic lights?\b/gi, '')
    .replace(/\bred[, ]+yellow[, ]+green\b/gi, '')
    .replace(/\bmacos\b/gi, '')
    .replace(/\baddress bar\b/gi, '')
    .replace(/\btitle bar\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function layoutRulesForDevice(device: DesignPreviewBreakpoint): string {
  const { width } = DESIGN_BREAKPOINT_PRESETS[device]
  if (device === 'desktop') {
    return [
      `- Diseño de escritorio (PC) a ancho completo del frame (${width}px).`,
      '- Navegación horizontal (logo + menú + CTA), hero amplio, grids de 2–4 columnas, footer en varias columnas.',
      '- El contenido debe ocupar el ancho útil del frame; NO centres una columna estrecha tipo móvil (390px) con grandes márgenes vacíos a los lados.',
      '- Usa CSS con width: 100% en contenedores principales; max-width opcional ~1200–1280px centrado solo si el diseño lo pide, pero el layout debe sentirse desktop.',
    ].join('\n')
  }
  if (device === 'tablet') {
    return [
      `- Diseño tablet (${width}px): layouts híbridos, 2 columnas en cards/grids, navegación compacta pero horizontal cuando encaje.`,
      '- Ocupa el ancho del frame; evita márgenes laterales excesivos.',
    ].join('\n')
  }
  return [
    `- Diseño móvil (${width}px): una columna, navegación compacta o inferior, touch-friendly.`,
    '- Contenido a ancho completo del viewport móvil.',
  ].join('\n')
}

/** System instruction para generación de mockups según dispositivo objetivo. */
export function designGenerateSystemInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  const stepX = width + 64
  return `Eres un diseñador de producto y UI. Generas SOLO artefactos de diseño (HTML estático), sin backend ni frameworks (no React, no Next.js).

Responde con estos bloques en markdown:

1) \`\`\`json spec/design.json
{
  "version": 2,
  "title": "...",
  "summary": "...",
  "targetDevice": "${device}",
  "tokens": { "colors": { "primary": "#...", "background": "#...", "text": "#..." }, "fonts": { "body": "...", "heading": "..." } },
  "pages": [
    { "id": "home", "name": "Inicio", "path": "design/site/index.html", "width": ${width}, "height": ${height}, "x": 0, "y": 0 },
    { "id": "pricing", "name": "Precios", "path": "design/pages/pricing/index.html", "width": ${width}, "height": ${height}, "x": ${stepX}, "y": 0 }
  ]
}
\`\`\`

2) \`\`\`markdown spec/design.md
# Título — decisiones de diseño y mapa de páginas.
\`\`\`

3) Una o más páginas HTML COMPLETAS (cada una es una pantalla entera navegable):
- Página principal: \`\`\`html design/site/index.html
- Páginas adicionales: \`\`\`html design/pages/<id>/index.html

Cada HTML debe ser una página completa:
- <!DOCTYPE html>, <html>, <head> con <title> y <meta viewport>
- body con min-height: 100vh
${layoutRulesForDevice(device)}
- Secciones reales (hero, features, footer, nav…) según el prompt
- Forms/login solo visuales
- data-sk-id en elementos editables (texto, botones, enlaces, imágenes)
- CSS en <style> o archivo .css referenciado

IMÁGENES (fotos, heroes, productos, avatares, banners):
- NO uses via.placeholder.com, picsum.photos ni bloques vacíos como sustituto de fotos reales.
- Para cada foto necesaria, declara un tag FUERA de los bloques de código (en markdown suelto):
  [IMAGE: design/site/assets/<nombre>.jpg | descripción visual detallada en inglés | aspecto]
- En el HTML referencia la misma ruta relativa desde la página, p. ej. <img src="assets/hero.jpg" alt="..." data-sk-id="sk-hero-img">
- Para design/pages/<id>/index.html usa rutas como assets/<nombre>.jpg y el tag [IMAGE: design/pages/<id>/assets/<nombre>.jpg | …]
- Incluye 2–6 imágenes según el tipo de web. Aspectos: 16:9 heroes/banners, 1:1 avatares/producto, 4:3 cards.
- TODAS las fotos del sitio deben compartir la MISMA dirección de arte (misma luz, fondo y gradación). En cada prompt [IMAGE:] en inglés, repite el mismo prefijo de estilo y luego solo el sujeto.

Genera TODAS las páginas que el producto necesite (típicamente 2–5: inicio, detalle, pricing, login, dashboard…).
Cada pantalla debe ser un frame independiente en el canvas (coordenadas x/y distintas en spec/design.json; width=${width}, height=${height} en cada página).
NO incluyas prototypeLinks ni navegación entre páginas salvo que el usuario lo pida explícitamente.

No generes src/, spec/spec.md ni código de app.`
}

/** Solo paleta y tipografía (antes de generar HTML de pantallas). */
export function designTokensSystemInstruction(): string {
  return `Eres un diseñador de sistemas visuales. Define la paleta y tipografía para un sitio web.

Responde SOLO con un bloque JSON:

\`\`\`json spec/design-tokens.json
{
  "colorMode": "light",
  "colors": {
    "seed": "#HEX",
    "primary": "#HEX",
    "secondary": "#HEX",
    "tertiary": "#HEX",
    "neutral": "#HEX",
    "background": "#HEX",
    "surface": "#HEX",
    "text": "#HEX",
    "border": "#HEX"
  },
  "fonts": { "body": "Inter, system-ui, sans-serif", "heading": "Inter, system-ui, sans-serif" }
}
\`\`\`

Reglas:
- Colores en hex de 6 dígitos, coherentes con el producto y el tono del brief.
- primary = color de marca; secondary y tertiary = armonía (análogos o complementarios suaves).
- neutral para bordes y texto secundario; background/surface/text según colorMode light u dark.
- No generes HTML ni lista de pantallas.`
}

/** Paso 1: plan (spec + tokens + mapa de pantallas), sin HTML ni PNG de pantalla completa. */
export function designPlanSystemInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  const stepX = width + 64
  return `Eres un diseñador de producto y UI. Planificas un sitio web para un pipeline que generará HTML estático pantalla a pantalla (código editable, no una imagen de la página entera).

Responde SOLO con:

1) \`\`\`json spec/design.json
{
  "version": 2,
  "title": "...",
  "summary": "...",
  "targetDevice": "${device}",
  "source": "vertex",
  "tokens": { "colorMode": "light", "colors": { "seed": "#...", "primary": "#...", "secondary": "#...", "tertiary": "#...", "neutral": "#...", "background": "#...", "surface": "#...", "text": "#...", "border": "#..." }, "fonts": { "body": "Inter, system-ui, sans-serif", "heading": "Inter, system-ui, sans-serif" } },
  "pages": [
    { "id": "home", "name": "Inicio", "path": "design/site/index.html", "width": ${width}, "height": 2600, "x": 0, "y": 0, "media": "html" },
    { "id": "catalog", "name": "Catálogo", "path": "design/pages/catalog/index.html", "width": ${width}, "height": 1500, "x": ${stepX}, "y": 0, "media": "html" }
  ]
}
\`\`\`

2) \`\`\`markdown spec/design.md
# Título — decisiones de diseño, tokens, lista de pantallas y secciones clave por pantalla.
\`\`\`

Reglas:
- Cada page: media "html", path a design/site/index.html o design/pages/<id>/index.html.
- OBLIGATORIO: 2–5 pantallas según el producto (p. ej. inicio + características + precios + contacto, o catálogo + producto + carrito). NUNCA devuelvas solo la pantalla "home"/"Inicio" salvo que el brief pida explícitamente una landing de una sola página.
- width=${width} en todas; **height distinto por pantalla** según contenido (landing/home 2200–3000, listados 1200–1700, detalle 1800–2400, carrito/checkout 1000–1400, páginas simples 900–1200). No uses la misma altura en todas.
- Define tokens.colors completos (seed, primary, secondary, tertiary, neutral, background, surface, text, border) antes que nada en el JSON.
- NO generes bloques HTML ni mockups PNG de pantalla completa.
- NO uses Imagen para la página entera; las fotos irán como assets vía tags [IMAGE:] en pasos posteriores.
- No generes src/ ni código de app.`
}

/** Paso 2: una sola pantalla en HTML+CSS (mockup estático no funcional). */
export function designSinglePageHtmlInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  return `Eres un diseñador UI. Generas UNA pantalla en HTML estático + CSS (mockup visual no funcional).

Responde SOLO con un bloque markdown html en la ruta indicada.

Reglas:
- Mockup estático: sin JavaScript ni fetch; enlaces internos con href reales entre páginas (/ o /pages/{id}); formularios con data-form-id y campos name (sin action).
- Layout real en DOM (header, nav, sections, footer, grids, tipografía) — NO sustituyas la página por un PNG ni background con captura.
- data-sk-id en todos los elementos editables.
- Usa los design tokens del spec (variables :root).
- Frame ancho ~${width}px; altura según secciones reales (landing larga con hero+grids+footer, no comprimas en 100vh). body { margin:0 }; el mockup puede superar ${height}px si el contenido lo requiere.
${layoutRulesForDevice(device)}
- Fotos de ESTA pantalla (hero, producto, avatar): declara tags FUERA del bloque html (se generan e insertan ahora en esta página):
  [IMAGE: design/site/assets/<archivo>.jpg | prompt en inglés | aspecto]
  o [IMAGE: design/pages/<id>/assets/<archivo>.jpg | …]
- En el HTML: <img src="assets/…"> con la misma ruta relativa; solo imágenes que pertenezcan a esta pantalla (0–4).
- Mientras el asset se genera, el layout debe verse completo: reserva espacio con min-height en contenedores de foto y fondo neutro (p. ej. #e8e8ec); no dejes huecos colapsados.
- No declares [IMAGE:] para otras pantallas del sitio.
- Coherencia fotográfica: si spec/design.md define ## Photography & Imagery, copia ese estilo en TODOS los prompts [IMAGE:] de esta pantalla (carrito, catálogo, upsell incluidos).
- Si el prompt incluye "Chrome del sitio (referencia obligatoria)", copia header, nav y footer de esa referencia de forma idéntica (mismo HTML, data-sk-id y clases); solo personaliza el contenido dentro de <main>.
- Si es la primera pantalla del sitio, diseña header/nav/footer canónicos que el resto de páginas replicarán.
- NO generes otras pantallas ni spec/design.json en esta respuesta.`
}

/** System instruction para pipeline GCP: Gemini genera estructura JSON + prompts Imagen 4 (sin HTML). */
export function designStructureSystemInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  const stepX = width + 64
  const aspect = aspectRatioFromPageDimensions(width, height)
  return `Eres un diseñador de producto y UI. Generas la ESTRUCTURA de un diseño web para un pipeline automatizado:
1) Gemini (tú) → spec JSON con prompts por pantalla
2) Imagen 4 → mockups visuales PNG por pantalla
3) (automático, no lo generes) → HTML estático editable por pantalla a partir de cada PNG

Responde SOLO con estos bloques markdown (SIN HTML):

1) \`\`\`json spec/design.json
{
  "version": 2,
  "title": "...",
  "summary": "...",
  "targetDevice": "${device}",
  "source": "vertex-imagen",
  "tokens": { "colors": { "primary": "#...", "background": "#...", "text": "#..." }, "fonts": { "body": "...", "heading": "..." } },
  "pages": [
    {
      "id": "home",
      "name": "Inicio",
      "path": "design/mockups/home.png",
      "media": "image",
      "width": ${width},
      "height": ${height},
      "x": 0,
      "y": 0,
      "aspectRatio": "${aspect}",
      "imagePrompt": "Complete full-length web page (${width}×${height}px): header, all main sections, and footer visible in one tall composition — not a cropped hero-only slice. ${MOCKUP_FULL_BLEED_RULES_EN}"
    },
    {
      "id": "pricing",
      "name": "Precios",
      "path": "design/mockups/pricing.png",
      "media": "image",
      "width": ${width},
      "height": ${height},
      "x": ${stepX},
      "y": 0,
      "aspectRatio": "${aspect}",
      "imagePrompt": "Detailed English prompt for pricing page..."
    }
  ]
}
\`\`\`

2) \`\`\`markdown spec/design.md
# Título — decisiones de diseño, tokens, mapa de pantallas.
\`\`\`

Reglas:
- Cada page debe tener media: "image", path: "design/mockups/<id>.png", imagePrompt en inglés (detallado, 2–4 frases).
- imagePrompt debe describir layout, secciones, textos visibles, estilo visual coherente con tokens.
- imagePrompt OBLIGATORIO: página web COMPLETA de arriba a abajo (${width}×${height}px) — nav, todas las secciones y footer en una sola imagen alta; NO solo el hero ni un recorte 16:9.
- La imagen ES el artboard Figma de la página entera, no ventana de navegador ni dispositivo.
- Prohibido en imagePrompt: "browser window", "screenshot", "device mockup", "presentation", traffic lights, tabs, address bar.
- Describe el layout (${device}, ${width}×${height}px), NO una foto de pantalla ni dispositivo.
- Genera 2–5 pantallas según el producto (inicio, detalle, pricing, login, dashboard…).
- Coordenadas x/y distintas en el canvas (width=${width}, height=${height}).
- NO incluyas bloques HTML ni tags [IMAGE:].
- NO generes src/ ni código de app.`
}

export function designMockupHtmlFromImageInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  return `Eres un diseñador UI. El PNG adjunto es SOLO referencia visual (como un frame de Figma): úsalo para ver jerarquía, copy, colores y espaciado. Tu salida es HTML+CSS reconstruido, NO una copia del bitmap.

Responde SOLO con un bloque markdown html en la ruta indicada (design/site/index.html para home, design/pages/<id>/index.html para el resto).

Reglas del HTML:
- Paso 1 del producto: mockup estático VISUALMENTE completo pero NO funcional (sin JS, sin fetch, sin backend, sin rutas reales).
- Enlaces con href="#" o javascript:void(0); formularios solo visuales (sin action real).
- RECONSTRUYE el diseño: <header>, <nav>, <main>, <section>, <footer>, grids flex/grid, tipografía y botones reales en el DOM — no sustituyas la página por el PNG.
- PROHIBIDO: <img> o background-image del PNG completo de la pantalla; object-fit cover del mockup como única capa; un solo wrapper con la captura a pantalla completa.
- El PNG no debe aparecer en el HTML salvo que el usuario lo pida explícitamente; no enlaces ../mockups/*.png como sustituto del layout.
- <img> solo para fotos de contenido (productos, heroes, avatares) con rutas assets/… o placeholders descriptivos; cada bloque de UI debe ser HTML editable.
- data-sk-id en TODOS los elementos editables (header, nav, section, h1-h3, p, a, button, img, li, footer…).
- Usa los design tokens del spec cuando existan (CSS variables :root).
- Frame: body { margin:0 }, min-height 100vh, ancho útil ~${width}px (layout ${device}, ${width}×${height}px).
- PROHIBIDO simular ventana de navegador u OS: sin barra de título, sin botones rojo/amarillo/verde, sin chrome de tabs/URL.
- El <header> del sitio es navegación del producto, NO chrome del navegador.
- El usuario debe poder seleccionar y editar secciones individuales en el DOM.
- NO generes src/ ni código de app.`
}

/** Prefijo de instrucción cuando el usuario adjunta imágenes de referencia. */
export function designVisualReferencePrompt(): string {
  return `

REFERENCIA VISUAL ADJUNTA (prioridad alta):
1. **Auditoría visual** — Antes de inventar tokens o layout, inspecciona la(s) imagen(es): zonas (header, main, sidebar, footer), proporciones de columnas (p. ej. 65/35), densidad, alineaciones y componentes repetidos (cards, filas de carrito, summary box, upsell, steppers, badges).
2. **Color** — Extrae hex aproximados de fondos, superficies, texto, bordes, CTA y acentos visibles; úsalos en YAML y CSS (no sustituyas por paletas genéricas SaaS si la captura muestra otra identidad).
3. **Tipografía** — Identifica pareja display/body (serif vs sans), pesos en títulos, precios, labels y navegación; refleja esa jerarquía en tokens y HTML.
4. **Componentes** — Nombra y reproduce patrones visibles (p. ej. order-summary, quantity-stepper, line-item-row, pill CTA, trust badges, promo strip).
5. **Fidelidad estructural** — Replica el orden de secciones de la captura (bento, grid productos, testimonios). Prohibido sustituir un bento asimétrico por tres columnas planas de features.
6. **Una pantalla** — Si brief o captura muestran una sola vista (home, cart, checkout), no inventes páginas extra.
7. **Copy** — Conserva o traduce textos legibles; no reemplaces por lorem ni cambies de sector (p. ej. pollitos → café editorial).
8. **Bocetos** — Wireframe → UI pulida con la misma topología de cajas.
9. **Assets generados** — Prompts [IMAGE:] con el mismo estilo fotográfico que la referencia.`
}

/** Reglas extra para el agente de layout JSON cuando hay captura de referencia. */
export function designVisualReferenceLayoutAddendum(): string {
  return `
REFERENCIA VISUAL — LAYOUT JSON:
- Replica la estructura de la captura: orden de secciones, columnas, sidebar vs main, bloques upsell/footer.
- Usa section.type descriptivos alineados con lo visto (site-header, cart-line-items, order-summary, upsell-strip, site-footer, etc.).
- layoutStrategy por página debe reflejar la composición observada (split, two-column-checkout, asymmetric-grid solo si la imagen lo muestra).
- Si el usuario pide una pantalla concreta, declara SOLO esa page (id slug coherente: cart, checkout, home…) con las secciones visibles; no añadas home genérica con hero salvo que aparezca en la imagen.
- La fidelidad a la referencia visual gana sobre variedad inventada.`
}

/** Reglas extra para HTML/CSS cuando hay captura de referencia. */
export function designVisualReferenceHtmlAddendum(): string {
  return `
REFERENCIA VISUAL — HTML:
- Implementa la misma grilla, anchos relativos, espaciado y jerarquía que la captura (flex/grid explícitos).
- Coloca header, listas, summary card, CTAs y footer en las mismas regiones visuales.
- Aplica los hex y tipografías de spec/design.md; el HTML debe parecer la misma pantalla, no un tema genérico con otro layout.
- Reutiliza clases/estructura repetible para filas de producto, steppers y cajas resumen como en la referencia.`
}

export function designFigmaImportSystemInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const base = designGenerateSystemInstruction(device)
  return `${base}

IMPORTACIÓN DESDE FIGMA:
- Recibirás un resumen JSON del árbol de nodos de Figma (frames, textos, colores, auto-layout).
- Conviértelo en mockups HTML semánticos y responsivos con Tailwind/CSS inline.
- Preserva copy, jerarquía de secciones y nombres de pantallas cuando existan.
- Mapea auto-layout horizontal/vertical a flexbox; fills y colores a clases o variables CSS.
- No inventes pantallas que no estén en el resumen salvo una home mínima si falta contenido.`
}

/** @deprecated Usa designGenerateSystemInstruction(device) */
export const DESIGN_GENERATE_SYSTEM = designGenerateSystemInstruction('desktop')

export function designIterateSystemInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
  media: 'html' | 'image' = 'html',
): string {
  if (media === 'image') {
    const { width } = DESIGN_BREAKPOINT_PRESETS[device]
    return `Eres un diseñador UI. Recibes un mockup visual (PNG) de una pantalla y un prompt de cambio.
El mockup está pensado para ${device === 'desktop' ? 'escritorio (PC)' : device === 'tablet' ? 'tablet' : 'móvil'} (~${width}px).

Devuelve SOLO un bloque JSON con el imagePrompt actualizado:

\`\`\`json spec/design-page-update.json
{
  "imagePrompt": "Updated detailed English prompt for Imagen 4 reflecting the requested changes..."
}
\`\`\`

El imagePrompt debe ser completo (no un diff) e incluir el estilo visual coherente con el diseño existente.
${MOCKUP_FULL_BLEED_RULES_EN}`
  }
  const { width } = DESIGN_BREAKPOINT_PRESETS[device]
  return `Eres un diseñador UI. Recibes HTML de una página de mockup y un prompt de cambio.
El mockup está pensado para ${device === 'desktop' ? 'escritorio (PC)' : device === 'tablet' ? 'tablet' : 'móvil'} (~${width}px de ancho de frame).
${device === 'desktop' ? 'Mantén layout desktop a ancho completo; no conviertas la página en una columna móvil centrada.' : ''}

Devuelve SOLO el HTML completo actualizado en un bloque markdown:

\`\`\`html <misma-ruta-del-archivo>
<!DOCTYPE html>... página completa con data-sk-id en elementos editables ...
\`\`\`

Mantén la misma ruta de archivo. No generes src/ ni código de app.

Si el usuario NO pide cambiar imágenes/fotos: conserva INTACTOS todos los <img src="assets/..."> existentes (mismas rutas y data-sk-id). No los sustituyas por divs de gradiente ni placeholders vacíos.

Si añades o cambias fotos explícitamente, incluye tags [IMAGE: design/site/assets/… | prompt en inglés | aspecto] fuera del bloque HTML y <img src="assets/…"> coherentes en el mockup.

Si el usuario adjuntó imágenes de referencia, alinea el cambio con la jerarquía y estilo visual de esas referencias.`
}

export const DESIGN_ITERATE_SYSTEM = designIterateSystemInstruction('desktop')

export const DESIGN_REIMAGINE_SYSTEM = `Generas variantes VISUALES del mismo layout (misma estructura de secciones, distinto estilo: colores, tipografía, bordes).

${MOCKUP_FULL_BLEED_RULES_EN}

Para mockups PNG (pipeline Imagen), responde con bloques JSON:
\`\`\`json design/variants/v1/prompt.json
{ "imagePrompt": "Variant 1: detailed English prompt..." }
\`\`\`
\`\`\`json design/variants/v2/prompt.json
{ "imagePrompt": "Variant 2: detailed English prompt..." }
\`\`\`

Para mockups HTML legacy, responde con bloques html design/variants/vN/index.html.

Sin backend.`

const DESIGN_TO_CODE_SHARED = `
Los mockups HTML en design/ son referencia visual. **spec/design.md** gana sobre tokens JSON.
**spec/site-manifest.json** define páginas y enlaces — respétalo.
Genera archivos con bloques markdown \`\`\`path\`\`\`.
SIEMPRE incluye preview/index.html (y preview/{slug}/index.html por ruta) como HTML estático fiel al diseño para preview en Vercel.`

const DESIGN_TO_CODE_BY_TEMPLATE: Record<CodeTemplate, string> = {
  html: `Conviertes el diseño aprobado en un sitio HTML estático desplegable.
${DESIGN_TO_CODE_SHARED}
- Archivos en preview/ (HTML, CSS, JS opcional en preview/assets/).
- No uses React ni Next.js salvo que el usuario lo pida explícitamente.
- Enlaza páginas del manifiesto con rutas relativas entre preview/*.`,

  wordpress: `Conviertes el diseño en un tema WordPress instalable.
${DESIGN_TO_CODE_SHARED}
- Un bloque por archivo bajo export/wordpress/ (style.css, functions.php, header.php, footer.php, index.php, page.php, templates/*.php).
- No resumas el tema en un README; genera PHP/CSS reales.
- preview/ HTML estático (sin PHP).`,

  woocommerce: `Conviertes el diseño en tema WordPress con soporte WooCommerce.
${DESIGN_TO_CODE_SHARED}
- Tema base en export/wordpress/ como arriba.
- Overrides WooCommerce en export/wordpress/woocommerce/ (archive-product.php, single-product.php, etc. si aplica).
- preview/ HTML estático del catálogo/checkout visual.`,

  shopify: `Conviertes el diseño en tema Shopify Online Store 2.0 instalable.
${DESIGN_TO_CODE_SHARED}
- Un bloque markdown por archivo (\`\`\`export/shopify/theme/...\`\`\`). Nunca sustituyas el tema por un solo README.
- Rutas obligatorias mínimas:
  export/shopify/theme/layout/theme.liquid
  export/shopify/theme/templates/index.json
  export/shopify/theme/templates/page.json
  export/shopify/theme/sections/header.liquid
  export/shopify/theme/sections/footer.liquid
  export/shopify/theme/sections/main-page.liquid (y secciones por bloque del diseño)
  export/shopify/theme/assets/theme.css (estilos desde spec/design.md)
  export/shopify/theme/config/settings_schema.json
- preview/: HTML/CSS estático fiel al diseño (sin Liquid).`,

  prestashop: `Conviertes el diseño en tema PrestaShop 8+.
${DESIGN_TO_CODE_SHARED}
- Tema en export/prestashop/themes/{slug}/: templates/*.tpl, assets/css/, assets/js/.
- Smarty en plantillas; respeta estructura de módulos.
- preview/ HTML estático.`,

  joomla: `Conviertes el diseño en plantilla Joomla 4+.
${DESIGN_TO_CODE_SHARED}
- Plantilla en export/joomla/templates/{slug}/: index.php, templateDetails.xml, css/, html/.
- Usa jdoc:include donde corresponda.
- preview/ HTML estático.`,
}

/** @deprecated Usar getDesignToCodeSystem(codeTemplate) */
export const DESIGN_TO_CODE_SYSTEM = DESIGN_TO_CODE_BY_TEMPLATE.html

export function getDesignToCodeSystem(codeTemplate: CodeTemplate): string {
  return DESIGN_TO_CODE_BY_TEMPLATE[codeTemplate] ?? DESIGN_TO_CODE_BY_TEMPLATE.html
}

/** Plan previo Spec-Kit (/design/plan): JSON con pantallas y prompts, no spec/design.json. */
export function designPlanScreensJsonInstruction(
  device: DesignPreviewBreakpoint = 'desktop',
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  const deviceLabel =
    device === 'desktop' ? 'escritorio (PC)' : device === 'tablet' ? 'tablet' : 'móvil'
  return `Eres un diseñador de producto. A partir de la especificación y el plan técnico del proyecto, genera SOLO un JSON válido (sin markdown) con esta forma:

{
  "title": "Nombre del producto",
  "summary": "Un párrafo",
  "tokens": {
    "colors": { "primary": "#...", "background": "#...", "text": "#..." },
    "fonts": { "body": "Inter", "heading": "Inter" }
  },
  "screens": [
    {
      "id": "home",
      "name": "Inicio",
      "prompt": "Descripción detallada de la pantalla para generar HTML mockup",
      "width": ${width},
      "height": ${height},
      "x": 0,
      "y": 0
    }
  ]
}

Dispositivo objetivo: ${deviceLabel}. Todas las pantallas: width=${width}. Asigna height distinto por pantalla (home ~2600, catálogo ~1500, detalle ~2300, carrito ~1200 en desktop).
Incluye 2–6 pantallas según el alcance del plan (nunca solo inicio salvo landing explícita de una página). Coordenadas x en incrementos de (width + 64).
${device === 'desktop' ? 'Los prompts de cada pantalla deben describir layouts desktop (nav horizontal, multi-columna), no apps móviles.' : device === 'mobile' ? 'Los prompts deben describir UI móvil de una columna.' : 'Los prompts deben describir UI tablet.'}`
}
