'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  requestMicrophonePermission,
  speechLangFromAppLang,
  type SpeechRecognitionInstance,
} from '@/lib/speech/speechRecognition'

type UseSpeechDictationOptions = {
  lang?: string
  getText: () => string
  setText: (text: string) => void
  onError?: (message: string) => void
}

export function useSpeechDictation({
  lang = 'es',
  getText,
  setText,
  onError,
}: UseSpeechDictationOptions) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(() =>
    typeof window !== 'undefined' ? isSpeechRecognitionSupported() : false,
  )
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const prefixRef = useRef('')
  const finalsRef = useRef('')

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      onError?.('unsupported')
      return
    }

    stop()

    const recognition = new Ctor()
    recognition.lang = speechLangFromAppLang(lang)
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    prefixRef.current = getText()
    finalsRef.current = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalsRef.current += transcript
        else interim += transcript
      }
      setText(prefixRef.current + finalsRef.current + interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      onError?.(event.error)
      stop()
    }

    recognition.onend = () => {
      setText(prefixRef.current + finalsRef.current)
      recognitionRef.current = null
      setListening(false)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
    } catch {
      onError?.('start-failed')
      stop()
    }
  }, [getText, lang, onError, setText, stop])

  const toggle = useCallback(async () => {
    if (listening) {
      stop()
      return
    }
    const allowed = await requestMicrophonePermission()
    if (!allowed) {
      onError?.('not-allowed')
      return
    }
    start()
  }, [listening, onError, start, stop])

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported())
  }, [])

  useEffect(() => () => stop(), [stop])

  return { listening, supported, start, stop, toggle }
}
