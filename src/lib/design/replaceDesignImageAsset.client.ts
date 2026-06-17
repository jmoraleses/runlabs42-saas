/** Utilidades cliente para sustituir <img> en mockups de diseño. */

export function isVisualEditImageElement(element: { tagName: string } | null | undefined): boolean {
  return element?.tagName.toLowerCase() === 'img'
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

export function imageExtensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

export function designPageAssetPaths(
  htmlPath: string,
  fileName: string,
): { projectPath: string; srcAttr: string } {
  const baseDir = htmlPath.includes('/') ? htmlPath.slice(0, htmlPath.lastIndexOf('/') + 1) : ''
  return {
    projectPath: `${baseDir}assets/${fileName}`,
    srcAttr: `assets/${fileName}`,
  }
}
