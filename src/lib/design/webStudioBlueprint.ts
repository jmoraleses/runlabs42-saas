import type { DesignPageMeta } from '@/lib/design/types'

export type DesignDeviceType = 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC'

export type WebStudioPageDef = {
  screenTitle: string
  pageId: string
  deviceType: DesignDeviceType
  width: number
  height: number
  prompt: string
}

export const WEB_STUDIO_PAGE_ALIASES: Record<string, string> = {
  studio: 'studio',
  'runlabs42-studio': 'studio',
  editor: 'studio',
  landing: 'home',
  inicio: 'home',
  home: 'home',
  precios: 'pricing',
  pricing: 'pricing',
  contacto: 'contact',
  contact: 'contact',
  marketplace: 'marketplace',
  proyectos: 'projects',
  projects: 'projects',
  about: 'about',
  acerca: 'about',
  'acerca-de': 'about',
}

export const WEB_STUDIO_PROJECT_TITLE = 'Web Studio'

export const WEB_STUDIO_PAGES: WebStudioPageDef[] = [
  {
    screenTitle: 'Studio',
    pageId: 'studio',
    deviceType: 'DESKTOP',
    width: 1440,
    height: 900,
    prompt: `Diseño desktop 1440×900 del editor "Runlabs42 Studio" (SaaS de creación de apps con IA).
Layout de 3 columnas: barra superior con logo Runlabs42, nombre de proyecto editable, pestañas centrales "Diseño | Vista previa | Dividido | Código", estado de guardado y botones Guardar/Descargar/Publicar.
Columna izquierda (~240px): árbol de archivos del proyecto (spec/, design/, src/).
Centro: lienzo de diseño con frames de pantallas o vista previa de la app.
Columna derecha (~360px): panel de chat IA con historial de mensajes, selector de modelo, chips Spec-Kit/autofix, y compositor de prompt abajo.
Estilo: minimalismo corporativo moderno, paleta indigo profundo (#15157d / #2e3192) y acentos teal (#00696f), fondo claro #f8f9ff, tipografía Inter, bordes suaves, sombras sutiles. Sin texto lorem excesivo; UI realista y pulida.`,
  },
  {
    screenTitle: 'Landing',
    pageId: 'home',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 720,
    prompt: `Landing desktop SaaS: hero con titular "Cuéntanos tu idea. Te ayudamos a crearla.", subtítulo sobre generar páginas y código, compositor de prompt grande con chips (página de negocio, portfolio, precios, contacto), CTA "Empezar gratis".
Sección "Cómo funciona" en 4 pasos: Especifica, Diseña, Construye, Publica.
Grid de confianza / logos. Footer con columnas Producto, Recursos, Empresa, Legal.
Estilo coherente: indigo + teal, Inter, mucho espacio en blanco, aspecto SaaS premium.`,
  },
  {
    screenTitle: 'Precios',
    pageId: 'pricing',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 900,
    prompt: `Página de precios Runlabs42: header de marketing, 3–4 tarjetas de planes (Starter, Pro, Team) con precio mensual, lista de características, botón CTA por plan, FAQ breve abajo.
Mismo design system indigo/teal, Inter, cards blancas con borde sutil.`,
  },
  {
    screenTitle: 'Contacto',
    pageId: 'contact',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 800,
    prompt: `Página de contacto Runlabs42: título, texto breve, formulario (nombre, email, mensaje, enviar), información de soporte.
Layout centrado, limpio, mismos colores de marca.`,
  },
  {
    screenTitle: 'Marketplace',
    pageId: 'marketplace',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 900,
    prompt: `Marketplace de plantillas Runlabs42: barra de búsqueda/filtros, grid de tarjetas de proyecto con miniatura, título, autor, rating y precio en créditos.
Header de navegación global Runlabs42. Estilo indigo/teal consistente.`,
  },
  {
    screenTitle: 'Proyectos',
    pageId: 'projects',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 900,
    prompt: `Dashboard "Mis proyectos" Runlabs42: botón crear proyecto, grid de tarjetas con preview, nombre, framework, fecha; estados vacío con CTA.
Nav superior estándar. Misma identidad visual.`,
  },
  {
    screenTitle: 'Acerca',
    pageId: 'about',
    deviceType: 'DESKTOP',
    width: 1280,
    height: 800,
    prompt: `Página Acerca de Runlabs42: misión de la plataforma (IA + diseño + código en el navegador), equipo/valores en bloques, CTA a Studio.
Tonos indigo/teal, tipografía Inter, diseño editorial limpio.`,
  },
]

export function resolveWebStudioPageId(screenTitle: string, index: number): string {
  const slug = screenTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (WEB_STUDIO_PAGE_ALIASES[slug]) return WEB_STUDIO_PAGE_ALIASES[slug]
  if (slug === 'inicio' || slug === 'home') return 'home'
  return slug.slice(0, 48) || `screen-${index + 1}`
}

export function applyWebStudioLayout(
  pages: DesignPageMeta[],
  blueprint: WebStudioPageDef[] = WEB_STUDIO_PAGES,
): DesignPageMeta[] {
  const gap = 64
  let x = 0
  const y = 0
  const byId = new Map(blueprint.map((d) => [d.pageId, d]))
  const order = ['home', 'studio', 'pricing', 'contact', 'marketplace', 'projects', 'about']

  const sorted = [...pages].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return sorted.map((p) => {
    const def = byId.get(p.id)
    const w = def?.width ?? p.width ?? 1280
    const h = def?.height ?? p.height ?? 800
    const out = { ...p, width: w, height: h, x, y }
    x += w + gap
    return out
  })
}
