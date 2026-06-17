/** Lee archivos de imagen del portapapeles (API async). */
export async function readClipboardImageFiles(): Promise<File[]> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return []
  try {
    const items = await navigator.clipboard.read()
    const files: File[] = []
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith('image/')) continue
        const blob = await item.getType(type)
        const ext = type.split('/')[1] ?? 'png'
        files.push(new File([blob], `clipboard.${ext}`, { type }))
      }
    }
    return files
  } catch {
    return []
  }
}
