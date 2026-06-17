/* Frameworks — alineado con shell.jsx y API */
export const FRAMEWORKS = [
  { id: 'react', name: 'React', icon: 'React', group: 'web' as const },
  { id: 'vue', name: 'Vue', icon: 'Vue', group: 'web' as const },
  { id: 'next', name: 'Next.js', icon: 'Next', group: 'web' as const },
  { id: 'svelte', name: 'Svelte', icon: 'Svelte', group: 'web' as const },
  { id: 'astro', name: 'Astro', icon: 'Astro', group: 'web' as const },
  { id: 'solid', name: 'Solid.js', icon: 'Solid', group: 'web' as const },
  { id: 'vanilla', name: 'HTML/JS', icon: 'HTML', group: 'web' as const },
  { id: 'canvas-app', name: 'Canvas Draw', icon: 'Draw', group: 'canvas' as const },
  { id: 'canvas-game', name: 'Canvas Game', icon: 'Game', group: 'canvas' as const },
  { id: 'p5', name: 'p5.js', icon: 'p5', group: 'canvas' as const },
  { id: 'phaser', name: 'Phaser', icon: 'Phaser', group: 'canvas' as const },
  { id: 'three', name: 'Three.js', icon: 'Three', group: 'canvas' as const },
] as const

/* AI Models */
export const MODELS = [
  { id: 'claude-sonnet', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'claude-haiku', name: 'Claude Haiku 3.5', provider: 'Anthropic' },
  { id: 'claude-opus', name: 'Claude Opus 4', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gemini-2.0', name: 'Gemini 2.0', provider: 'Google' },
  { id: 'deepseek', name: 'DeepSeek', provider: 'DeepSeek' },
] as const

/* Pricing Plans */
export const PRICING_PLANS = {
  free: { name: 'Free', credits: 0, price: 0, features: ['Landing access'] },
  starter: {
    name: 'Starter',
    credits: 50,
    price: 10,
    features: ['50 credits', 'Basic support'],
  },
  pro: {
    name: 'Pro',
    credits: 60,
    price: 25,
    features: ['60 credits + 10% bonus', 'Email support'],
  },
  team: {
    name: 'Team',
    credits: 65,
    price: 50,
    features: ['65 credits + 20% bonus', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    credits: 135,
    price: 100,
    features: ['135 credits + 30% bonus', 'Dedicated support'],
  },
} as const

/** Créditos incluidos por plan (renovación mensual). */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 25,
  starter: 100,
  pro: 100,
  team: 600,
  demo: 100,
}

const DEFAULT_PLAN_CREDITS = 25

export function getPlanCreditLimit(plan: string): number {
  const credits = PLAN_MONTHLY_CREDITS[plan]
  if (credits !== undefined) return credits
  return PLAN_MONTHLY_CREDITS.free ?? DEFAULT_PLAN_CREDITS
}

/* Credit Costs */
export const CREDIT_COSTS = {
  plan: 10,
  spec: 8,
  build: 12,
  review: 5,
  css: 3,
  marketplace_base: 5,
} as const

/* Error Messages */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  INSUFFICIENT_CREDITS: 'Insufficient credits to perform this action',
  INVALID_EMAIL: 'Please enter a valid email address',
  WEAK_PASSWORD:
    'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  EMAIL_EXISTS: 'An account with this email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  NETWORK_ERROR: 'Network error. Please try again.',
  STRIPE_ERROR: 'Payment processing failed. Please try again.',
  DATABASE_ERROR: 'Database error. Please try again later.',
} as const

/* Success Messages */
export const SUCCESS_MESSAGES = {
  ACCOUNT_CREATED: 'Account created successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET: 'Password reset email sent',
  PROJECT_CREATED: 'Project created successfully',
  CREDITS_PURCHASED: 'Credits purchased successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
} as const

/* Local Storage Keys */
export const LOCAL_STORAGE_KEYS = {
  THEME: 'spec-kit:theme',
  LANGUAGE: 'spec-kit:language',
  USER_PREFERENCES: 'spec-kit:preferences',
  DRAFT_PROJECTS: 'spec-kit:drafts',
  EDITOR_TABS: 'spec-kit:tabs',
} as const

/* API Endpoints */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
  },
  USER: {
    PROFILE: '/api/user/profile',
    CREDITS: '/api/user/credits',
    TRANSACTIONS: '/api/user/transactions',
  },
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    GET: (id: string) => `/api/projects/${id}`,
    UPDATE: (id: string) => `/api/projects/${id}`,
    DELETE: (id: string) => `/api/projects/${id}`,
  },
  STREAM: '/api/stream',
  CHECKOUT: '/api/checkout',
  MARKETPLACE: {
    PRODUCTS: '/api/marketplace/products',
    GET: (id: string) => `/api/marketplace/products/${id}`,
    PURCHASE: '/api/marketplace/purchase',
    PURCHASES: '/api/marketplace/purchases',
  },
} as const

/* Timeouts (in ms) */
export const TIMEOUTS = {
  API_REQUEST: 30000,
  DEBOUNCE_INPUT: 300,
  NOTIFICATION: 3000,
  STREAM_TIMEOUT: 120000,
} as const

/* Validation */
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PROJECT_NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  EMAIL_MAX_LENGTH: 255,
} as const
