import { jsonError } from '@/lib/api/errors'
export { dynamic } from '@/lib/api/routeSegment'
import {
  DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING,
  DESIGN_CLARIFY_QUESTIONS_SETTING_KEY,
  parseDesignClarifyQuestionsEnabled,
} from '@/lib/platform/designClarifyQuestionsSetting'
import {
  DEFAULT_SPEECH_DICTATION_SETTING,
  parseSpeechDictationEnabled,
  SPEECH_DICTATION_SETTING_KEY,
} from '@/lib/platform/speechDictationSetting'
import { createAdminClient } from '@/lib/supabase/admin'

/** Configuración pública de funciones (lectura sin auth). */
export async function GET() {
  try {
    let speechDictationEnabled = DEFAULT_SPEECH_DICTATION_SETTING.enabled
    let designClarifyQuestionsEnabled = DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('admin_settings')
        .select('key, value')
        .in('key', [SPEECH_DICTATION_SETTING_KEY, DESIGN_CLARIFY_QUESTIONS_SETTING_KEY])
      for (const row of data ?? []) {
        if (row.key === SPEECH_DICTATION_SETTING_KEY) {
          speechDictationEnabled = parseSpeechDictationEnabled(row.value)
        }
        if (row.key === DESIGN_CLARIFY_QUESTIONS_SETTING_KEY) {
          designClarifyQuestionsEnabled = parseDesignClarifyQuestionsEnabled(row.value)
        }
      }
    } catch {
      /* Supabase no configurado en local: mantener valor por defecto */
    }
    return Response.json({ speechDictationEnabled, designClarifyQuestionsEnabled })
  } catch (e) {
    return jsonError(e)
  }
}
