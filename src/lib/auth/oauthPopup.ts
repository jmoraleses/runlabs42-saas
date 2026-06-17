const POPUP_FEATURES = 'popup=yes,width=600,height=720,left=100,top=100'

function oauthLoadingHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectando…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#444}</style>
</head><body><p>Conectando…</p></body></html>`
}

function writeLoadingPage(win: Window): void {
  try {
    win.document.open()
    win.document.write(oauthLoadingHtml())
    win.document.close()
  } catch {
    /* ventana en blanco si el navegador restringe document */
  }
}

/** Abre ventana emergente pequeña (settings u otros flujos legacy). */
export function openOAuthPopupWindow(channel: string): Window {
  if (typeof window === 'undefined') {
    throw new Error('OAuth solo disponible en el navegador')
  }
  const popup = window.open('about:blank', channel, POPUP_FEATURES)
  if (!popup) {
    throw new Error('El navegador bloqueó la ventana. Permite ventanas emergentes o pestañas para este sitio.')
  }
  writeLoadingPage(popup)
  return popup
}

/** Abre pestaña nueva en el mismo tick del gesto del usuario (antes de awaits). */
export function openOAuthTabWindow(channel: string): Window {
  if (typeof window === 'undefined') {
    throw new Error('OAuth solo disponible en el navegador')
  }
  const tab = window.open('about:blank', channel)
  if (!tab) {
    throw new Error('El navegador bloqueó la pestaña. Permite ventanas emergentes o pestañas para este sitio.')
  }
  writeLoadingPage(tab)
  return tab
}

/** Espera postMessage del callback OAuth en una ventana ya abierta. */
export function waitForOAuthPopup(popup: Window, channel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const origin = window.location.origin

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      const data = event.data as { channel?: string; ok?: boolean; message?: string }
      if (data?.channel !== channel) return
      cleanup()
      if (data.ok) resolve()
      else reject(new Error(data.message ?? 'No se pudo conectar'))
    }

    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup()
        reject(new Error('Ventana cerrada antes de completar la autorización'))
      }
    }, 400)

    function cleanup() {
      window.removeEventListener('message', onMessage)
      window.clearInterval(poll)
    }

    window.addEventListener('message', onMessage)
  })
}

/**
 * Abre ventana flotante para OAuth cuando la URL ya está disponible (sin awaits previos).
 */
export function openOAuthPopup(authorizationUrl: string, channel: string): Promise<void> {
  const popup = openOAuthPopupWindow(channel)
  popup.location.href = authorizationUrl
  return waitForOAuthPopup(popup, channel)
}

/**
 * OAuth con URL obtenida de forma asíncrona: abre popup al instante y navega tras el fetch.
 */
export async function openOAuthPopupAfterFetch(
  fetchAuthorizationUrl: () => Promise<string>,
  channel: string,
): Promise<void> {
  const popup = openOAuthPopupWindow(channel)
  try {
    popup.location.href = await fetchAuthorizationUrl()
    await waitForOAuthPopup(popup, channel)
  } catch (e) {
    try {
      popup.close()
    } catch {
      /* ignore */
    }
    throw e
  }
}

/**
 * OAuth en pestaña: abre pestaña al instante y navega tras el fetch.
 */
export async function openOAuthTabAfterFetch(
  fetchAuthorizationUrl: () => Promise<string>,
  channel: string,
): Promise<void> {
  const tab = openOAuthTabWindow(channel)
  try {
    tab.location.href = await fetchAuthorizationUrl()
    await waitForOAuthPopup(tab, channel)
  } catch (e) {
    try {
      tab.close()
    } catch {
      /* ignore */
    }
    throw e
  }
}
