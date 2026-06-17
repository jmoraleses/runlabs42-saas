import type { CodeTemplate } from '@/lib/codeTemplates'

export type AutoCaptureSource = 'stitch' | 'external'

export type AutoPublishMode = 'assist' | 'auto'

export type AutoMarketplaceTarget = 'templatemonster' | 'themeforest'

export type AutoScreenPrompt = {
  id: string
  name: string
  prompt: string
}

export type AutoRunConfig = {
  projectId: string
  captureSource: AutoCaptureSource
  niche: string
  variantCount: number
  storeTemplates: CodeTemplate[]
  stitchProjectId?: string
  createStitchProject: boolean
  screenPrompts: AutoScreenPrompt[]
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET'
  seedUrls?: string[]
  navigateLinks?: boolean
  publishToMarketplace: boolean
  marketplaceTarget: AutoMarketplaceTarget
  publishMode: AutoPublishMode
}

export type AutoPhase =
  | 'generate-themes-prompts'
  | 'stitch-connect'
  | 'stitch-generate-screens'
  | 'stitch-fetch-assets'
  | 'import-local-site'
  | 'wire-navigation'
  | 'build-store-templates'
  | 'generate-covers'
  | 'package-marketplace'
  | 'marketplace-fill-upload'
  | 'await-confirm'
  | 'saved'
  | 'error'

export type AutoRunEvent = {
  phase: AutoPhase | string
  message?: string
  progress?: string
  variantId?: string
  pageId?: string
  codeTemplate?: string
  counts?: Record<string, number>
  artifactPath?: string
  coverSource?: 'vertex' | 'sharp-fallback'
  error?: string
}

export type AutoStitchScreenRecord = {
  pageId: string
  screenId: string
  title: string
  htmlPath: string
  pngPath: string
}

export type AutoRunState = {
  runId: string
  projectTitle?: string
  config: AutoRunConfig
  themes?: Array<{
    id: string
    name: string
    styleBrief: string
  }>
  selectedTheme?: {
    id: string
    name: string
    styleBrief: string
  }
  screenPromptsUsed?: AutoScreenPrompt[]
  stitchProjectId?: string
  screens: AutoStitchScreenRecord[]
  variants: Array<{
    id: string
    codeTemplate: CodeTemplate
    exportPrefix: string
    coverPath?: string
    listingPath?: string
    packagePath?: string
    status: 'pending' | 'ok' | 'failed'
    error?: string
  }>
}

export type AutoRunSend = (event: AutoRunEvent) => void
