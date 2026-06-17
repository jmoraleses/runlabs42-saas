/* User Types */
export interface User {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  plan: 'free' | 'starter' | 'pro' | 'team'
  credits: number
  creditsRenewedAt: string
  stripeCustomerId: string | null
  settings: UserSettings
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: boolean
  onboardingCompleted?: boolean
  onboardingCompletedAt?: string
}

import type { MobileConfig, MobileReadiness, TargetPlatform } from '@/types/mobile'
import type { CodeTemplate } from '@/lib/codeTemplates'
import type { CodeTemplateLinkParamMap } from '@/lib/design/codeTemplateConvert'

export type { MobileConfig, MobileReadiness, TargetPlatform } from '@/types/mobile'
export type { CodeTemplate } from '@/lib/codeTemplates'
export type { CodeTemplateLinkParamMap } from '@/lib/design/codeTemplateConvert'

/* Project Types */
export interface Project {
  id: string
  userId: string
  name: string
  description: string | null
  framework: string
  status: 'active' | 'archived' | 'draft' | 'shipped' | 'deleted'
  public: boolean
  createdAt: string
  updatedAt: string
  deployedUrl?: string | null
  githubRepo?: string | null
  coverUrl?: string | null
  coverImages?: string[] | null
  marketplaceListed?: boolean
  targetPlatforms?: TargetPlatform[]
  mobileConfig?: MobileConfig | null
  mobileReadiness?: MobileReadiness | null
  lastMobileBuildAt?: string | null
  designApprovedAt?: string | null
  designPhase?: 'design' | 'code'
  codeTemplate?: CodeTemplate
  codeTemplateLinkParamMap?: CodeTemplateLinkParamMap | null
}

export interface Spec {
  id: string
  projectId: string
  content: string
  version: number
  createdBy: string | null
  createdAt: string
}

/* Transaction Types */
export interface Transaction {
  id: string
  userId: string
  amount: number
  type: 'debit' | 'credit' | 'refund'
  description: string | null
  model: string | null
  tokensUsed: number | null
  stripeChargeId: string | null
  createdAt: string
}

/* Marketplace Types */
export interface MarketplaceProduct {
  id: string
  creatorId: string
  name: string
  description: string | null
  category: string | null
  priceCredits: number
  previewUrl: string | null
  coverImages?: string[] | null
  code: string
  rating: number
  downloads: number
  publishedAt: string | null
  createdAt: string
}

export interface MarketplacePurchase {
  id: string
  userId: string
  productId: string
  purchasedAt: string
}

/* API Response Types */
export interface ApiResponse<T> {
  data: T
  error?: string
  status: number
}

export interface ApiError {
  error: string
  status: number
  details?: Record<string, unknown>
}

/* Auth Types */
export interface SignUpInput {
  email: string
  password: string
  fullName: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ResetPasswordInput {
  email: string
}

export interface NewPasswordInput {
  token: string
  password: string
}

/* Command Types */
export interface AICommand {
  command: '/plan' | '/spec' | '/build' | '/review' | '/css' | '/mobile-fix'
  prompt: string
  projectId?: string
  context?: string
}

export interface StreamToken {
  type:
    | 'token'
    | 'cost'
    | 'done'
    | 'error'
    | 'files'
    | 'file_delta'
    | 'file_delete'
    | 'phase'
    | 'phase-model'
    | 'images'
    | 'scan_result'
    | 'build_progress'
    | 'chat_insight'
  data: string
}

/* UI Types */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent'
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'select'
  placeholder?: string
  error?: string
  required?: boolean
}
