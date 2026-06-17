export type SpeechRecognitionResultEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      length: number
      [index: number]: { transcript: string }
    }
  }
}

export type SpeechRecognitionErrorEvent = {
  error: string
  message?: string
}

export type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null
}

/** Solicita permiso de micrófono (dispara el diálogo nativo del navegador). */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) track.stop()
    return true
  } catch {
    return false
  }
}

export function speechLangFromAppLang(lang: string): string {
  switch (lang) {
    case 'en':
      return 'en-US'
    case 'fr':
      return 'fr-FR'
    case 'de':
      return 'de-DE'
    case 'it':
      return 'it-IT'
    case 'nl':
      return 'nl-NL'
    default:
      return 'es-ES'
  }
}
