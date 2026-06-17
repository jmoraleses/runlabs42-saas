import path from 'path'
import { readdir, readFile, stat } from 'fs/promises'

export type TemplateProductSeed = {
  title: string
  description: string
}

const FALLBACK_PRODUCTS: TemplateProductSeed[] = [
  { title: 'Producto plantilla · Starter', description: 'Producto generado por la plantilla descargada.' },
  { title: 'Producto plantilla · Pro', description: 'Producto generado por la plantilla descargada.' },
  { title: 'Producto plantilla · Enterprise', description: 'Producto generado por la plantilla descargada.' },
]

function cleanText(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractProductsFromHtml(html: string): TemplateProductSeed[] {
  const candidates = new Set<string>()
  const productLikeBlocks = html.match(
    /<(article|li|div)[^>]*(product|producto|catalog|catalogo|card|item)[^>]*>[\s\S]*?<\/\1>/gi,
  )
  if (productLikeBlocks?.length) {
    for (const block of productLikeBlocks) {
      const titleMatch = block.match(/<(h1|h2|h3|h4|strong)[^>]*>([\s\S]*?)<\/\1>/i)
      const name = cleanText(titleMatch?.[2] ?? '')
      if (name.length >= 3 && name.length <= 120) candidates.add(name)
    }
  }
  if (!candidates.size) {
    const headingMatches = [...html.matchAll(/<(h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/gi)]
    for (const match of headingMatches) {
      const text = cleanText(match[2] ?? '')
      if (/(producto|product|pack|plan|kit|modelo)/i.test(text) && text.length <= 120) {
        candidates.add(text)
      }
      if (candidates.size >= 12) break
    }
  }
  const picked = [...candidates].slice(0, 12)
  if (!picked.length) return FALLBACK_PRODUCTS
  return picked.map((title) => ({
    title,
    description: `Producto creado automáticamente desde la plantilla HTML: ${title}.`,
  }))
}

async function newestProjectHtmlPath(workspaceRoot: string): Promise<string | null> {
  const projectsRoot = path.join(workspaceRoot, '.data', 'local-projects')
  let entries: string[] = []
  try {
    entries = await readdir(projectsRoot)
  } catch {
    return null
  }
  let newest: { htmlPath: string; mtimeMs: number } | null = null
  for (const entry of entries) {
    const htmlPath = path.join(projectsRoot, entry, 'files', 'index.html')
    try {
      const info = await stat(htmlPath)
      if (!newest || info.mtimeMs > newest.mtimeMs) newest = { htmlPath, mtimeMs: info.mtimeMs }
    } catch {
      // ignore
    }
  }
  return newest?.htmlPath ?? null
}

export async function loadTemplateProductSeed(workspaceRoot: string): Promise<{
  products: TemplateProductSeed[]
  source: string
}> {
  const htmlPath = await newestProjectHtmlPath(workspaceRoot)
  if (!htmlPath) {
    return {
      products: FALLBACK_PRODUCTS,
      source: 'fallback',
    }
  }
  const html = await readFile(htmlPath, 'utf8').catch(() => '')
  if (!html.trim()) {
    return {
      products: FALLBACK_PRODUCTS,
      source: 'fallback',
    }
  }
  return {
    products: extractProductsFromHtml(html),
    source: path.relative(workspaceRoot, htmlPath),
  }
}
