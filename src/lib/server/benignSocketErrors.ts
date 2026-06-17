/** Petición SSE/fetch cancelada por el cliente (botón Parar, navegación). */
export function isRequestAborted(signal?: AbortSignal, err?: unknown): boolean {
  if (signal?.aborted) return true
  return isBenignClientDisconnect(err)
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('The operation was aborted.')
    err.name = 'AbortError'
    throw err
  }
}

/** Errores de socket cuando el cliente cierra la petición (navegación, abort, HMR). */
export function isBenignClientDisconnect(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.message === 'aborted' || err.name === 'AbortError') return true
    const code = (err as NodeJS.ErrnoException).code
    if (
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      code === 'ERR_INVALID_STATE'
    ) {
      return true
    }
    if (
      err instanceof TypeError &&
      /already closed|Invalid state/i.test(err.message)
    ) {
      return true
    }
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code ?? '')
    if (
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      code === 'ERR_INVALID_STATE'
    ) {
      return true
    }
  }
  return false
}

/** Fallo al escribir en un ReadableStream SSE ya cerrado por el cliente. */
export function isBenignStreamWriteError(err: unknown): boolean {
  return isBenignClientDisconnect(err)
}

function shouldSuppressConsoleError(args: unknown[]): boolean {
  for (const arg of args) {
    if (isBenignClientDisconnect(arg)) return true
    if (arg instanceof Error && arg.message === 'aborted') return true
    if (typeof arg === 'string' && /\bError:\s*aborted\b/i.test(arg)) return true
  }
  return false
}

const BENIGN_HANDLERS_KEY = '__specBenignSocketHandlersRegistered'

/** Reduce ruido en `next dev` por desconexiones normales del navegador. */
export function registerBenignSocketErrorHandlers(): void {
  if (process.env.NODE_ENV !== 'development') return
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as typeof globalThis & {
    [BENIGN_HANDLERS_KEY]?: boolean
  }
  if (g[BENIGN_HANDLERS_KEY]) return
  g[BENIGN_HANDLERS_KEY] = true

  const originalError = console.error
  console.error = (...args: unknown[]) => {
    if (shouldSuppressConsoleError(args)) return
    originalError.apply(console, args)
  }

  process.on('uncaughtException', (err) => {
    if (isBenignClientDisconnect(err)) return
    throw err
  })
}
