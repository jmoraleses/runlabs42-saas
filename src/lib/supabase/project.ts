/** Supabase project ref (Runlabs42 production). */
export const SUPABASE_PROJECT_REF = 'uqawltpguhjnkioqeqsh'

export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`

/** OAuth apps (GitHub/Google) must register this callback — not the Vercel URL. */
export const SUPABASE_OAUTH_CALLBACK = `${SUPABASE_URL}/auth/v1/callback`

export const APP_AUTH_CALLBACKS = [
  'https://www.runlabs42.com/auth/callback',
  'https://runlabs42.com/auth/callback',
  'https://runlabs42.vercel.app/auth/callback',
  'https://runlabs42-runlabs42.vercel.app/auth/callback',
  'http://localhost:3000/auth/callback',
  'http://localhost:3010/auth/callback',
  'https://*.vercel.app/auth/callback',
] as const
