#!/usr/bin/env node
/**
 * Comprueba variables locales / checklist OAuth (no modifica Supabase ni Google Cloud).
 * Uso: node scripts/check-oauth-env.mjs
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_CALLBACK = 'https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

console.log('\n=== OAuth Runlabs42 — checklist ===\n')
console.log('Supabase callback (Google Cloud → Authorized redirect URIs):')
console.log(`  ${SUPABASE_CALLBACK}\n`)

console.log('Supabase → URL Configuration → Redirect URLs (añadir todas):')
;[
  'https://www.runlabs42.com/auth/callback',
  'https://runlabs42.com/auth/callback',
  'https://runlabs42.vercel.app/auth/callback',
  'http://localhost:3010/auth/callback',
].forEach((u) => console.log(`  ${u}`))

console.log('\nVercel / local:')
console.log(`  NEXT_PUBLIC_APP_URL: ${APP_URL || '(vacío — usar https://www.runlabs42.com)'}`)
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

console.log('Supabase Google provider:')
console.log(
  '  https://supabase.com/dashboard/project/uqawltpguhjnkioqeqsh/auth/providers\n',
)
