#!/usr/bin/env node
/**
 * Comprueba variables locales / checklist OAuth (no modifica Supabase ni Google Cloud).
 * Uso: node scripts/check-oauth-env.mjs
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_CALLBACK = supabaseUrl
  ? `${supabaseUrl}/auth/v1/callback`
  : 'https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010').replace(/\/$/, '')

console.log('\n=== OAuth — checklist ===\n')
console.log('Supabase callback (Google Cloud → Authorized redirect URIs):')
console.log(`  ${SUPABASE_CALLBACK}\n`)

console.log('Supabase → URL Configuration → Redirect URLs (añadir):')
;[
  `${APP_URL}/auth/callback`,
  'http://localhost:3010/auth/callback',
  'http://127.0.0.1:3010/auth/callback',
].forEach((u) => console.log(`  ${u}`))

console.log('\nVariables:')
console.log(`  NEXT_PUBLIC_APP_URL: ${APP_URL}`)
console.log(
  `  NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(vacío)'}`,
)

const gemini = process.env.GEMINI_API_KEY?.trim() || ''
if (gemini.startsWith('GOCSPX-')) {
  console.log(
    '\n⚠️  GEMINI_API_KEY parece un OAuth Client Secret (GOCSPX-).',
  )
  console.log('    Pon el GOCSPX en Supabase → Google provider, no en GEMINI_API_KEY.')
  console.log('    Gemini usa clave AIza… desde https://aistudio.google.com/apikey\n')
}

console.log('Supabase Google provider (sustituye TU-PROJECT-REF):')
console.log(
  '  https://supabase.com/dashboard/project/TU-PROJECT-REF/auth/providers\n',
)
