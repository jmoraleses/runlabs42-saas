'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import {
  DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING,
  parseDesignClarifyQuestionsEnabled,
} from '@/lib/platform/designClarifyQuestionsSetting'
import {
  DEFAULT_SPEECH_DICTATION_SETTING,
  parseSpeechDictationEnabled,
} from '@/lib/platform/speechDictationSetting'

type PlatformFeatures = {
  speechDictationEnabled: boolean
  designClarifyQuestionsEnabled: boolean
  loaded: boolean
}

export function usePlatformFeatures(): PlatformFeatures {
  const [speechDictationEnabled, setSpeechDictationEnabled] = useState(
    DEFAULT_SPEECH_DICTATION_SETTING.enabled,
  )
  const [designClarifyQuestionsEnabled, setDesignClarifyQuestionsEnabled] = useState(
    DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled,
  )
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      apiFetch<{ speechDictationEnabled?: boolean; designClarifyQuestionsEnabled?: boolean }>(
        '/api/platform/features',
      )
        .then((data) => {
          if (cancelled) return
          setSpeechDictationEnabled(parseSpeechDictationEnabled(data.speechDictationEnabled))
          setDesignClarifyQuestionsEnabled(
            parseDesignClarifyQuestionsEnabled(data.designClarifyQuestionsEnabled),
          )
        })
        .catch(() => {
          if (!cancelled) {
            setSpeechDictationEnabled(DEFAULT_SPEECH_DICTATION_SETTING.enabled)
            setDesignClarifyQuestionsEnabled(
              DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled,
            )
          }
        })
        .finally(() => {
          if (!cancelled) setLoaded(true)
        })
    }

    load()
    const onRefresh = () => load()
    window.addEventListener('platform-features-changed', onRefresh)
    return () => {
      cancelled = true
      window.removeEventListener('platform-features-changed', onRefresh)
    }
  }, [])

  return { speechDictationEnabled, designClarifyQuestionsEnabled, loaded }
}
