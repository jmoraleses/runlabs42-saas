/** Mensaje de error legible para el usuario en el chat del editor. */
export function formatStreamErrorMessage(
  status: number,
  serverMessage?: string,
): string {
  const msg = serverMessage?.trim()
  if (status === 402) {
    return msg && /crédito/i.test(msg)
      ? msg
      : 'No tienes créditos suficientes. Recarga en Ajustes → Suscripción.'
  }
  if (status === 429) {
    return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'
  }
  if (status === 413) {
    return msg ?? 'El proyecto supera el límite de almacenamiento.'
  }
  if (status >= 500) {
    return msg ?? 'Error del servidor. Inténtalo de nuevo en unos segundos.'
  }
  return msg ?? 'No se pudo completar la solicitud de IA.'
}

export function assistantErrorContent(message: string): string {
  const text = message.trim() || 'Error desconocido.'
  return text.startsWith('⚠️') ? text : `⚠️ ${text}`
}

/** Errores de red del navegador (sin respuesta HTTP). */
export function formatNetworkStreamError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return ''
  if (error instanceof Error) {
    if (error.name === 'AbortError') return ''
    const msg = error.message.trim()
    if (
      msg === 'Failed to fetch' ||
      /failed to fetch|networkerror|load failed/i.test(msg)
    ) {
      return 'No se pudo conectar con el servidor de IA. Comprueba que el dev server sigue en marcha (npm run dev) y vuelve a intentarlo; si acabas de guardar muchos archivos, espera unos segundos.'
    }
    return msg || 'Error de red al conectar con el asistente.'
  }
  return 'Error de red al conectar con el asistente.'
}
