/** Copia una imagen PNG al portapapeles o la descarga si el navegador no lo permite. */

export type CopyDesignPagePngResult = 'clipboard' | 'download'

function slugifyFileName(name: string): string {
  const base = name
    .trim()
    .replace(/^☑\s*/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'page'
}

export function designPagePngFileName(pageName: string, pageId: string): string {
  const slug = slugifyFileName(pageName)
  const id = pageId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)
  return `${slug}${id ? `-${id}` : ''}.png`
}

export async function copyOrDownloadPagePng(
  blob: Blob,
  fileName: string,
): Promise<CopyDesignPagePngResult> {
  const type = blob.type?.startsWith('image/') ? blob.type : 'image/png'
  const clipApi = navigator.clipboard

  if (clipApi?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await clipApi.write([new ClipboardItem({ [type]: blob })])
      return 'clipboard'
    } catch {
      /* fallback a descarga */
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return 'download'
  } finally {
    URL.revokeObjectURL(url)
  }
}
