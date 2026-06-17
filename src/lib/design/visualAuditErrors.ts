/** La captura adjunta no pudo auditarse; bloquea generación sin referencia fiable. */
export class VisualAuditRequiredError extends Error {
  readonly code = 'VISUAL_AUDIT_REQUIRED'

  constructor(
    message = 'No se pudo analizar la imagen de referencia. Vuelve a adjuntarla o usa una captura más pequeña.',
  ) {
    super(message)
    this.name = 'VisualAuditRequiredError'
  }
}
