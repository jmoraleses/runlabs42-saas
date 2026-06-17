/** El prompt sugiere que el usuario esperaba adjuntar una captura de referencia. */
export function promptImpliesVisualReference(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  return /\b(réplica|replica fiel|replicar|captura adjunta|captura de pantalla|screenshot|referencia visual|como la (imagen|captura)|igual que la (imagen|captura)|fiel a la captura|mockup|maqueta|basado en la imagen|based on the (image|screenshot))\b/i.test(
    p,
  )
}
