import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { getAIProvider, isGeminiEnabled, isVertexAIConfigured } from '@/lib/ai/config.server'
import { createClient } from '@/lib/supabase/server'
import { isVercel } from '@/lib/env'

export const runtime = 'nodejs'

export async function GET() {
  const vertex = isVertexAIConfigured()
  const checks: Record<string, boolean | string> = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: !!(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL),
    stripeSecret: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    serviceRole: !!(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    ),
    geminiApiKey: !!process.env.GEMINI_API_KEY?.trim(),
    vertex,
    geminiEnabled: isGeminiEnabled(),
    aiProvider: getAIProvider(),
    vertexHint: vertex
      ? 'ok'
      : 'Añade GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_CLOUD_* en .env.local y reinicia con npm run dev:clean',
  }

  let dbOk = false
  let dbMessage = 'skipped'
  if (checks.supabaseUrl && checks.supabaseAnon) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.from('users').select('id').limit(1)
      dbOk = !error
      dbMessage = error ? error.message : 'ok'
    } catch (err) {
      dbOk = false
      dbMessage = err instanceof Error ? err.message : 'error'
    }
  }
  checks.database = dbOk
  checks.databaseDetail = dbMessage

  const ok = Boolean(checks.supabaseUrl && checks.supabaseAnon && dbOk)

  return NextResponse.json(
    {
      ok,
      service: 'runlabs42-web',
      platform: isVercel() ? 'vercel' : 'local',
      timestamp: new Date().toISOString(),
      deploy: {
        env: process.env.VERCEL_ENV ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
      checks,
    },
    { status: ok ? 200 : 503 },
  )
}
