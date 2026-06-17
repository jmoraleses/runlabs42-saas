#!/usr/bin/env node
/**
 * Importa la plantilla HTML Studio (Web Studio) al proyecto Runlabs.
 * Uso: npx tsx scripts/seed-web-studio-studio.mjs --project-id=<uuid>
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const projectId = process.argv.find((a) => a.startsWith('--project-id='))?.split('=')[1]
if (!projectId) {
  console.error('Uso: npx tsx scripts/seed-web-studio-studio.mjs --project-id=<uuid>')
  process.exit(1)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan variables Supabase en .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const { data: row, error } = await supabase
    .from('projects')
    .select('id, name, user_id')
    .eq('id', projectId)
    .single()
  if (error || !row) {
    console.error('Proyecto no encontrado:', error?.message ?? projectId)
    process.exit(1)
  }

  const { applyWebStudioStudioSeed } = await import('../src/lib/design/seeds/webStudioSeed.ts')
  const { getProjectFilesStore } = await import('../src/lib/storage/projectFiles.ts')

  const ctx = {
    mode: 'db',
    store: getProjectFilesStore(supabase, row.user_id, row.id),
    supabase,
    user: { id: row.user_id },
  }

  console.log(`Sembrando Studio en: ${row.name} (${row.id})`)
  const result = await applyWebStudioStudioSeed(ctx, row.id)
  console.log('✓ Listo:', result.paths.join(', '))
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
