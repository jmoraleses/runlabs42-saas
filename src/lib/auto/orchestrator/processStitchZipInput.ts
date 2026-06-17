import path from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import type { OrchestratorPlatformId } from '@/lib/auto/orchestrator/platforms'
import { getOrchestratorPlatform } from '@/lib/auto/orchestrator/platforms'
import { getDemoProjectFilesStore } from '@/lib/storage/demoProjectFilesStore'
import { importStitchZipToProject } from '@/lib/auto/stitch/importStitchZipsFromFolder'
import { resolveDesignPages } from '@/lib/design/pages'
import { mergeCodeTemplateConvertOutput } from '@/lib/design/codeTemplateConvert'
import { persistSiteManifest } from '@/lib/design/siteManifest'
import { setupTemplateStacks } from '@/lib/auto/templates/setupTemplateStacks'
import { runTemplateStackInstallers } from '@/lib/auto/templates/runTemplateStackInstallers'
import { resolveStitchZipRoots } from '@/lib/auto/orchestrator/stitchZipPaths'
import { generateListingMetadata } from '@/lib/auto/marketplace/generateListingMetadata'
import { packageTemplateMonsterZip } from '@/lib/auto/marketplace/packageTemplateMonster'
import { loadTemplateProductSeed } from '@/lib/auto/orchestrator/templateProductSeed'
import { runPlatformSeed } from '@/lib/auto/orchestrator/platformSeed'

type ValidationResult = {
  ok: boolean
  checks: string[]
  errors: string[]
}

export type StitchZipProcessResult = {
  ok: boolean
  runId: string
  platformId: OrchestratorPlatformId
  inputZip: string
  outputDir: string
  reportPath: string
  validation: ValidationResult
  install: {
    ok: boolean
    runLogPath: string | null
    seedMessage: string
    seedDetails: string[]
  }
  templateMonster: {
    ok: boolean
    packagePath: string | null
    listingPath: string | null
    errors: string[]
  }
}

function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

function buildValidation(platformId: OrchestratorPlatformId, files: Array<{ path: string }>): ValidationResult {
  const checks: string[] = []
  const errors: string[] = []
  const hasPreview = files.some((f) => f.path.startsWith('preview/'))
  if (hasPreview) checks.push('preview files presentes')
  else errors.push('No se generó carpeta preview/')
  if (platformId === 'wordpress') {
    if (files.some((f) => f.path === 'export/wordpress/style.css')) checks.push('WordPress style.css OK')
    else errors.push('Falta export/wordpress/style.css')
  }
  if (platformId === 'joomla') {
    if (files.some((f) => f.path.endsWith('templateDetails.xml'))) checks.push('Joomla templateDetails.xml OK')
    else errors.push('Falta templateDetails.xml para Joomla')
  }
  if (platformId === 'prestashop') {
    if (files.some((f) => f.path.startsWith('export/prestashop/themes/'))) checks.push('PrestaShop theme tree OK')
    else errors.push('Falta export/prestashop/themes/')
  }
  return {
    ok: errors.length === 0,
    checks,
    errors,
  }
}

async function writeOutputFiles(outputDir: string, files: Array<{ path: string; content: string }>): Promise<void> {
  for (const file of files) {
    const full = path.join(outputDir, file.path)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, file.content, 'utf8')
  }
}

export async function processStitchZipInput(params: {
  platformId: OrchestratorPlatformId
  zipFileName: string
}): Promise<StitchZipProcessResult> {
  const roots = resolveStitchZipRoots()
  const platform = getOrchestratorPlatform(params.platformId)
  if (!platform) throw new Error('Plataforma no soportada')
  const inputZip = path.join(roots.inputsRoot, platform.id, params.zipFileName)
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const projectSlug = slugify(params.zipFileName.replace(/\.zip$/i, '')) || `zip-${runId}`
  const outputDir = path.join(roots.outputsRoot, platform.id, projectSlug)
  await mkdir(outputDir, { recursive: true })

  const demoProjectId = `demo-stitch-zip-${runId}`
  const store = getDemoProjectFilesStore(demoProjectId)
  const ctx = { mode: 'demo' as const, store }
  const imported = await importStitchZipToProject({
    ctx,
    zipPath: inputZip,
    projectTitle: projectSlug,
  })
  const designFiles = await store.list()
  const specRaw = designFiles.find((f) => f.path === 'spec/design.json')?.content ?? null
  const selectedPageIds = resolveDesignPages(designFiles, specRaw)
    .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
    .map((p) => p.id)
  const generatedFiles = mergeCodeTemplateConvertOutput({
    codeTemplate: platform.codeTemplate,
    projectName: projectSlug,
    framework: 'react',
    designFiles,
    selectedPageIds,
    generatedFromAi: [],
  })
  if (generatedFiles.length) await store.putMany(generatedFiles)
  const finalFiles = await store.list()
  await persistSiteManifest(store, finalFiles)
  await writeOutputFiles(outputDir, finalFiles.map((f) => ({ path: f.path, content: f.content })))

  const validation = buildValidation(platform.id, finalFiles.map((f) => ({ path: f.path })))

  const tmErrors: string[] = []
  let tmPackagePath: string | null = null
  let tmListingPath: string | null = null
  try {
    const listing = await generateListingMetadata({
      niche: 'ecommerce',
      codeTemplate: platform.codeTemplate,
      projectName: projectSlug,
      pageNames: imported.pages.map((p) => p.name),
    })
    const tm = await packageTemplateMonsterZip({
      ctx,
      variantId: runId,
      codeTemplate: platform.codeTemplate,
      projectName: projectSlug,
      listing,
      coverPngBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Yh7wAAAAASUVORK5CYII=',
      installablePath: `export/${platform.codeTemplate}/`,
    })
    const packageBuffer = Buffer.from(tm.zipBase64, 'base64')
    const tmDir = path.join(outputDir, 'templatemonster')
    await mkdir(tmDir, { recursive: true })
    tmPackagePath = path.join(tmDir, 'package.zip')
    tmListingPath = path.join(tmDir, 'listing.json')
    await writeFile(tmPackagePath, packageBuffer)
    const listingRaw = await store.get(tm.listingPath)
    await writeFile(tmListingPath, listingRaw?.content ?? JSON.stringify(listing, null, 2), 'utf8')
  } catch (error) {
    tmErrors.push(error instanceof Error ? error.message : 'Error empaquetando TemplateMonster')
  }

  await setupTemplateStacks(process.cwd())
  const installRun = await runTemplateStackInstallers(process.cwd(), {
    stackIds: [platform.installStackId],
    includeCloud: false,
    includeManual: false,
  })
  const installFirst = installRun.results[0]
  const templateSeed = await loadTemplateProductSeed(process.cwd())
  const seedResult = await runPlatformSeed(
    platform.id,
    process.cwd(),
    templateSeed.products,
    templateSeed.source,
  )

  const report = {
    runId,
    createdAt: new Date().toISOString(),
    platformId: platform.id,
    inputZip,
    outputDir,
    validation,
    templateMonster: {
      ok: tmErrors.length === 0 && Boolean(tmPackagePath),
      packagePath: tmPackagePath,
      listingPath: tmListingPath,
      errors: tmErrors,
    },
    install: {
      ok: Boolean(installFirst?.ok),
      runLogPath: installRun.runLogPath,
      installResult: installFirst ?? null,
      seedMessage: seedResult.message,
      seedDetails: seedResult.details,
    },
  }
  const reportsDir = path.join(outputDir, 'reports')
  await mkdir(reportsDir, { recursive: true })
  const reportPath = path.join(reportsDir, `${runId}.json`)
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')

  const processedDir = path.join(roots.inputsRoot, platform.id, '_processed')
  await mkdir(processedDir, { recursive: true })
  await rename(inputZip, path.join(processedDir, params.zipFileName)).catch(() => undefined)

  return {
    ok: validation.ok && Boolean(installFirst?.ok),
    runId,
    platformId: platform.id,
    inputZip,
    outputDir,
    reportPath,
    validation,
    install: {
      ok: Boolean(installFirst?.ok),
      runLogPath: installRun.runLogPath,
      seedMessage: seedResult.message,
      seedDetails: seedResult.details,
    },
    templateMonster: {
      ok: tmErrors.length === 0 && Boolean(tmPackagePath),
      packagePath: tmPackagePath,
      listingPath: tmListingPath,
      errors: tmErrors,
    },
  }
}

export async function inspectTemplateMonsterBundle(bundleZipPath: string): Promise<ValidationResult> {
  const checks: string[] = []
  const errors: string[] = []
  const raw = await readFile(bundleZipPath)
  const zip = await JSZip.loadAsync(raw)
  const names = Object.keys(zip.files)
  const required = [
    'marketplace/templatemonster/Documentation/index.html',
    'marketplace/templatemonster/Demo Content/README.txt',
    'marketplace/templatemonster/Preview/cover.png',
  ]
  for (const req of required) {
    if (names.includes(req)) checks.push(`TM: ${req}`)
    else errors.push(`TM missing: ${req}`)
  }
  return { ok: errors.length === 0, checks, errors }
}
