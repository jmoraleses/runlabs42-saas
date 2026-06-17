/** URL para leer/escribir un archivo con rutas anidadas (Next.js no enruta bien `spec%2F…` en `[path]`). */
export function projectFileContentUrl(projectId: string, filePath: string): string {
  return `/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`
}
