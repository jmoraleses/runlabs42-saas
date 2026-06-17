#!/usr/bin/env node
/**
 * Semilla Studio en proyecto demo local (.data/local-projects/<id>/).
 * No requiere Supabase service role.
 *
 * Uso: npx tsx scripts/seed-web-studio-local.mjs --project-id=<uuid>
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const projectId = process.argv.find((a) => a.startsWith('--project-id='))?.split('=')[1]
if (!projectId) {
  console.error('Uso: npx tsx scripts/seed-web-studio-local.mjs --project-id=<uuid>')
  process.exit(1)
}

const projectDir = resolve(root, '.data', 'local-projects', projectId)
if (!existsSync(projectDir)) {
  console.error('No existe proyecto demo local:', projectDir)
  console.error('Abre el Studio con ese project id en modo demo primero.')
  process.exit(1)
}

async function main() {
  const { applyWebStudioStudioSeed } = await import('../src/lib/design/seeds/webStudioSeed.ts')
  const { getDemoProjectFilesStore } = await import('../src/lib/storage/demoProjectFilesStore.ts')

  const ctx = { mode: 'demo', store: getDemoProjectFilesStore(projectId) }
  console.log('Sembrando Studio en', projectDir)
  const result = await applyWebStudioStudioSeed(ctx, projectId)
  console.log('✓', result.paths.join(', '))
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
