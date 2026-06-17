/** Errores de cancelación al desmontar Monaco (tokenización / setModel); no son fallos reales. */
export function isBenignMonacoCancelError(reason: unknown): boolean {
  if (reason == null) return false
  if (typeof reason === 'string') {
    return reason === 'Canceled' || reason.includes('Canceled')
  }
  if (reason instanceof Error) {
    return reason.message === 'Canceled' || reason.message.includes('Canceled')
  }
  if (typeof reason === 'object' && 'message' in reason) {
    const msg = String((reason as { message?: unknown }).message ?? '')
    return msg === 'Canceled' || msg.includes('Canceled')
  }
  return false
}
