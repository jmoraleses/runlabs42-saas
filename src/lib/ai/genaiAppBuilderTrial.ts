/**
 * Política de facturación para el crédito «Trial credit for GenAI App Builder».
 * Sin server-only para tests y scripts.
 */

export function isGenAiAppBuilderTrialCreditEnabled(): boolean {
  const raw = process.env.USE_GENAI_APP_BUILDER_TRIAL_CREDIT?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function getTrialDesignTextModelId(): string {
  return (
    process.env.TRIAL_DESIGN_GEN_MODEL?.trim() ||
    process.env.DESIGN_GEN_MODEL?.trim() ||
    'gemini-3.1-flash-lite'
  )
}

export function trialDisablesDesignImageGeneration(): boolean {
  if (!isGenAiAppBuilderTrialCreditEnabled()) return false
  const raw = process.env.DESIGN_IMAGE_GENERATION_ENABLED?.trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'yes') return false
  if (raw === '0' || raw === 'false' || raw === 'no') return true
  return true
}

export function trialBlocksAiStudioApiKeys(): boolean {
  return isGenAiAppBuilderTrialCreditEnabled()
}

/** Bloquea Agent Engine en trial salvo que el engine esté configurado explícitamente. */
export function trialBlocksDeployedAgentEngine(): boolean {
  if (!isGenAiAppBuilderTrialCreditEnabled()) return false
  const hasEngine = Boolean(
    process.env.DESIGN_AGENT_STUDIO_ENGINE?.trim() ||
      process.env.VERTEX_DESIGN_REASONING_ENGINE?.trim(),
  )
  if (hasEngine) return false
  return true
}
