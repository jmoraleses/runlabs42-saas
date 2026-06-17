import type { DesignTokens } from '@/lib/design/types'

export const DESIGN_PLAN_JSON = 'spec/design-plan.json'

export type DesignPlanScreen = {
  id: string
  name: string
  prompt: string
  width?: number
  height?: number
  x?: number
  y?: number
}

export type DesignPlanFile = {
  title?: string
  summary?: string
  tokens?: DesignTokens
  screens: DesignPlanScreen[]
}
