/** URL de foto de stock determinista para assets locales aún sin generación Vertex. */
export function picsumPhotoUrlForDesignAsset(projectRelativePath: string): string {
  const seed = projectRelativePath
    .replace(/^design\/site\//, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .slice(0, 80)
  const lower = projectRelativePath.toLowerCase()
  let w = 800
  let h = 533
  if (/avatar|profile|team|user/.test(lower)) {
    w = 400
    h = 400
  } else if (/hero|banner|background/.test(lower)) {
    w = 1200
    h = 675
  } else if (/class|product|grid|gallery|thumb|item/.test(lower)) {
    w = 720
    h = 480
  }
  return `https://picsum.photos/seed/${encodeURIComponent(seed || 'asset')}/${w}/${h}`
}
