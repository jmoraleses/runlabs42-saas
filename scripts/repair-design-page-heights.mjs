#!/usr/bin/env node
/**
 * Corrige alturas infladas en spec/design.json (bucle min-height:100vh + iframe alto).
 *
 * Uso:
 *   npx tsx scripts/repair-design-page-heights.mjs --dry-run
 *   npx tsx scripts/repair-design-page-heights.mjs --apply
 *   npx tsx scripts/repair-design-page-heights.mjs --project-id=<uuid> --apply
 *   npx tsx scripts/repair-design-page-heights.mjs --local --apply
 */
import { config } from 'dotenv'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const args = process.argv.slice(2)
const dryRun = !args.includes('--apply')
const localOnly = args.includes('--local')
const projectIdArg = args.find((a) => a.startsWith('--project-id='))?.split('=')[1]

function usage() {
  console.log(`
Repara page.height inflados en spec/design.json

  --dry-run          Solo informa (por defecto si no pasas --apply)
  --apply            Escribe los cambios
  --project-id=UUID  Un solo proyecto (Supabase o demo local)
  --local            Todos los proyectos en .data/local-projects/
  --all              Todos los proyectos con spec/design.json en Supabase

Ejemplos:
  npx tsx scripts/repair-design-page-heights.mjs --dry-run
  npx tsx scripts/repair-design-page-heights.mjs --project-id=abc --apply
  npx tsx scripts/repair-design-page-heights.mjs --local --apply
  npx tsx scripts/repair-design-page-heights.mjs --all --apply
`)
}

if (args.includes('--help') || args.includes('-h')) {
  usage()
  process.exit(0)
}

const {
  DESIGN_SPEC_JSON,
  repairDesignSpecPageHeights,
  stringifyDesignSpec,
} = await import('../src/lib/design/repairInflatedPageHeights.ts')
const { parseDesignSpec, pageHtmlPath } = await import('../src/lib/design/pages.ts')

async function buildHtmlByPath(store, pages) {
  const map = new Map()
  for (const page of pages ?? []) {
    if (page.media === 'image' || page.frameType === 'designSystem') continue
    const paths = new Set()
    if (page.path?.endsWith('.html')) paths.add(page.path)
    paths.add(pageHtmlPath(page.id))
    for (const p of paths) {
      if (map.has(p)) continue
      try {
        const file = await store.get(p)
        if (file?.content?.trim()) map.set(p, file.content)
      } catch {
        /* archivo ausente */
      }
    }
  }
  return map
}

async function repairProject({ label, store, specContent }) {
  const spec = parseDesignSpec(specContent)
  if (!spec?.pages?.length) {
    return { label, repairs: [], changed: false }
  }
  const htmlByPath = await buildHtmlByPath(store, spec.pages)
  const { spec: repaired, repairs } = repairDesignSpecPageHeights(spec, htmlByPath)
  if (repairs.length === 0) {
    return { label, repairs: [], changed: false }
  }
  if (!dryRun) {
    await store.put(DESIGN_SPEC_JSON, stringifyDesignSpec(repaired))
  }
  return { label, repairs, changed: true }
}

function logRepairs(result) {
  if (!result.repairs.length) return
  console.log(`\n${result.label}`)
  for (const r of result.repairs) {
    console.log(`  · ${r.pageId} (${r.name}): ${r.from}px → ${r.to}px`)
  }
}

async function repairLocalProject(projectId) {
  const { getDemoProjectFilesStore } = await import('../src/lib/storage/demoProjectFilesStore.ts')
  const store = getDemoProjectFilesStore(projectId)
  const specFile = await store.get(DESIGN_SPEC_JSON)
  if (!specFile?.content) return null
  return repairProject({
    label: `local:${projectId}`,
    store,
    specContent: specFile.content,
  })
}

async function repairDbProject(supabase, projectId) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, name, user_id')
    .eq('id', projectId)
    .single()
  if (pErr || !project) {
    console.warn('Proyecto no encontrado:', projectId, pErr?.message)
    return null
  }

  const { getProjectFilesStore } = await import('../src/lib/storage/projectFiles.ts')
  const store = getProjectFilesStore(supabase, project.user_id, project.id)
  const specFile = await store.get(DESIGN_SPEC_JSON)
  if (!specFile?.content) return null

  return repairProject({
    label: `${project.name} (${project.id})`,
    store,
    specContent: specFile.content,
  })
}

async function repairAllLocal() {
  const localRoot = resolve(root, '.data', 'local-projects')
  if (!existsSync(localRoot)) {
    console.error('No existe', localRoot)
    process.exit(1)
  }
  const dirs = readdirSync(localRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  let fixed = 0
  let scanned = 0
  for (const id of dirs) {
    scanned++
    const result = await repairLocalProject(id)
    if (!result) continue
    if (result.repairs.length) logRepairs(result)
    if (result.changed) fixed++
  }
  return { scanned, fixed }
}

async function repairAllDb(supabase) {
  const { data: rows, error } = await supabase
    .from('project_files')
    .select('project_id')
    .eq('path', DESIGN_SPEC_JSON)

  if (error) {
    console.error('Error listando proyectos:', error.message)
    process.exit(1)
  }

  const ids = [...new Set((rows ?? []).map((r) => r.project_id))]
  let fixed = 0
  let scanned = 0
  for (const id of ids) {
    scanned++
    const result = await repairDbProject(supabase, id)
    if (!result) continue
    if (result.repairs.length) logRepairs(result)
    if (result.changed) fixed++
  }
  return { scanned, fixed }
}

async function main() {
  const mode = dryRun ? 'DRY-RUN' : 'APPLY'
  console.log(`Reparación de alturas en design.json [${mode}]`)

  if (localOnly || (!projectIdArg && args.includes('--local'))) {
    const { scanned, fixed } = await repairAllLocal()
    console.log(`\nLocal: ${scanned} proyectos, ${fixed} con reparaciones${dryRun ? ' (sin escribir)' : ''}`)
    return
  }

  if (projectIdArg) {
    const localDir = resolve(root, '.data', 'local-projects', projectIdArg)
    const result = existsSync(localDir)
      ? await repairLocalProject(projectIdArg)
      : await (async () => {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY
          if (!url || !key) {
            console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
            process.exit(1)
          }
          return repairDbProject(createClient(url, key), projectIdArg)
        })()

    if (!result) {
      console.error('Sin spec/design.json o proyecto inexistente:', projectIdArg)
      process.exit(1)
    }
    logRepairs(result)
    console.log(
      result.changed
        ? dryRun
          ? '\nEjecuta con --apply para guardar.'
          : '\n✓ Guardado.'
        : '\nNada que reparar.',
    )
    return
  }

  if (!args.includes('--all')) {
    usage()
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan variables Supabase para --all')
    process.exit(1)
  }
  const supabase = createClient(url, key)
  const { scanned, fixed } = await repairAllDb(supabase)
  console.log(`\nSupabase: ${scanned} proyectos, ${fixed} con reparaciones${dryRun ? ' (sin escribir)' : ''}`)
  if (dryRun && fixed > 0) {
    console.log('Ejecuta con --apply para persistir los cambios.')
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
