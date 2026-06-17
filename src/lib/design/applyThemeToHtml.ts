import type { DesignSpec } from '@/lib/design/types'

function themeCssBlock(spec: DesignSpec): string {
  const c = spec.tokens?.colors ?? {}
  const primary = c.primary ?? '#3b82f6'
  const secondary = c.secondary ?? primary
  const tertiary = c.tertiary ?? primary
  const neutral = c.neutral ?? '#6b7280'
  const background = c.background ?? '#0f172a'
  const surface = c.surface ?? background
  const text = c.text ?? '#f8fafc'
  const border = c.border ?? neutral
  const body = spec.tokens?.fonts?.body ?? 'system-ui, sans-serif'
  const heading = spec.tokens?.fonts?.heading ?? body
  return `:root {
  --color-primary: ${primary};
  --color-secondary: ${secondary};
  --color-tertiary: ${tertiary};
  --color-neutral: ${neutral};
  --color-background: ${background};
  --color-surface: ${surface};
  --color-text: ${text};
  --color-border: ${border};
  --font-body: ${body};
  --font-heading: ${heading};
}
body {
  font-family: var(--font-body);
  background: var(--color-background);
  color: var(--color-text);
}`
}

/** Inyecta o actualiza variables de tema en el HTML del mockup. */
export function applyThemeToHtml(html: string, spec: DesignSpec): string {
  const block = themeCssBlock(spec)
  const styleTag = `<style id="runlabs-design-theme">\n${block}\n</style>`
  if (/<style[^>]*id=["']runlabs-design-theme["'][^>]*>/i.test(html)) {
    return html.replace(
      /<style[^>]*id=["']runlabs-design-theme["'][^>]*>[\s\S]*?<\/style>/i,
      styleTag,
    )
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${styleTag}\n</head>`)
  }
  if (/<body/i.test(html)) {
    return html.replace(/<body/i, `${styleTag}\n<body`)
  }
  return `${styleTag}\n${html}`
}
