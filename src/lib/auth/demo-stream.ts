/** Reglas compartidas para sesión demo en API (stream, editor, etc.). */

/** Desactivar solo con ALLOW_DEMO_STREAM=0 (p. ej. producción sin IA de prueba). */
export function isDemoStreamAllowed(): boolean {
  return process.env.ALLOW_DEMO_STREAM !== '0'
}

export function isDemoCookieValue(value: string | undefined | null): boolean {
  return value === '1'
}
