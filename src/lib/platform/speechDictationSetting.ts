export const SPEECH_DICTATION_SETTING_KEY = 'speech_dictation'

export type SpeechDictationSetting = {
  enabled: boolean
}

export const DEFAULT_SPEECH_DICTATION_SETTING: SpeechDictationSetting = {
  enabled: true,
}

export function parseSpeechDictationEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  if (value && typeof value === 'object' && 'enabled' in value) {
    const rawEnabled = (value as { enabled?: unknown }).enabled
    if (typeof rawEnabled === 'boolean') return rawEnabled
  }
  return DEFAULT_SPEECH_DICTATION_SETTING.enabled
}
