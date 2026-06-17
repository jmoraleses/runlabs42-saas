export type PreviewFileInput = { path: string; content: string }

/** Huella estable del contenido de archivos para refrescar el preview al editar. */
export function previewFilesKey(files: PreviewFileInput[]): string {
  let h = 2166136261
  for (const f of files) {
    const blob = `${f.path}\0${f.content}`
    for (let i = 0; i < blob.length; i++) {
      h ^= blob.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
  }
  return (h >>> 0).toString(36)
}
