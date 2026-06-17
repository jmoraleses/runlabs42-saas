/** Rechaza HTML que solo pega el PNG del mockup en lugar de reconstruir UI. */
export function mockupRelPathForPage(pageId: string): string {
  if (pageId === 'home' || pageId === 'index') {
    return `../mockups/${pageId === 'index' ? 'home' : pageId}.png`
  }
  return `../../mockups/${pageId}.png`
}

export function htmlEmbedsFullPageMockup(html: string, pageId: string): boolean {
  const normalized = html.toLowerCase()
  const mentionsMockupPng =
    normalized.includes('mockups/') &&
    (normalized.includes(`${pageId.toLowerCase()}.png`) ||
      (pageId === 'home' && normalized.includes('home.png')))
  if (!mentionsMockupPng) return false
  const hasFullBleedImg =
    /<img[^>]+src=["'][^"']*mockups\/[^"']+\.png["'][^>]*>/i.test(html) &&
    /(?:width:\s*100%|object-fit:\s*cover|position:\s*fixed|background(?:-image)?:\s*url\([^)]*mockups)/i.test(
      html,
    )
  const singleImgBody =
    (html.match(/<img\b/gi)?.length ?? 0) <= 1 &&
    /<body[^>]*>[\s\S]*<img[^>]*mockups\/[\s\S]*<\/body>/i.test(html)
  return hasFullBleedImg || singleImgBody
}
