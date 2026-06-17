export const DESIGN_CLARIFY_QUESTIONS_SETTING_KEY = 'design_clarify_questions'

export type DesignClarifyQuestionsSetting = {
  enabled: boolean
}

export const DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING: DesignClarifyQuestionsSetting = {
  enabled: true,
}

export function parseDesignClarifyQuestionsEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as DesignClarifyQuestionsSetting).enabled === true
  }
  return DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled
}
