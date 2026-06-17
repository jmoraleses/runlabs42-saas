import 'server-only'

import { randomUUID } from 'crypto'
import type { CodeTemplate } from '@/lib/codeTemplates'
import { CODE_TEMPLATES } from '@/lib/codeTemplates'
import { defaultEcommerceScreenPrompts } from '@/lib/auto/defaultScreens'
import { generateThemesAndPrompts, generateAutoProjectTitle } from '@/lib/auto/themes/generateThemesAndPrompts'
import { generateMarketplaceCover } from '@/lib/auto/covers/generateMarketplaceCover'
import { generateListingMetadata } from '@/lib/auto/marketplace/generateListingMetadata'
import { packageTemplateMonsterZip } from '@/lib/auto/marketplace/packageTemplateMonster'
import { runTemplateMonsterPublisher } from '@/lib/auto/marketplace/adapters/templateMonster'
import { generateFullStitchSite } from '@/lib/auto/stitch/generateFullStitchSite'
import { importStitchSiteToProject } from '@/lib/auto/stitch/importStitchSiteToProject'
import { buildStoreTemplates } from '@/lib/auto/templates/buildStoreTemplates'
import type { AutoRunConfig, AutoRunSend, AutoRunState } from '@/lib/auto/types'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export function parseAutoRunBody(body: Record<string, unknown>): AutoRunConfig {
  const variantCount = Math.min(12, Math.max(1, Number(body.variantCount) || 1))
  const storeTemplatesRaw = Array.isArray(body.storeTemplates) ? body.storeTemplates : ['html']
  const storeTemplates = storeTemplatesRaw
    .map((t) => String(t).trim().toLowerCase())
    .filter((t): t is CodeTemplate => (CODE_TEMPLATES as readonly string[]).includes(t))

  const niche = String(body.niche ?? '').trim() || 'tienda ecommerce moderna'
  const screenPrompts = Array.isArray(body.screenPrompts)
    ? body.screenPrompts.map((sp) => {
        const row = sp as Record<string, unknown>
        return {
          id: String(row.id ?? 'page'),
          name: String(row.name ?? row.id ?? 'Page'),
          prompt: String(row.prompt ?? niche),
        }
      })
    : defaultEcommerceScreenPrompts(niche)

  const selectedIds = Array.isArray(body.selectedScreenIds)
    ? body.selectedScreenIds.map(String)
    : null
  const filteredPrompts =
    selectedIds?.length
      ? screenPrompts.filter((p) => selectedIds.includes(p.id))
      : screenPrompts

  if (!filteredPrompts.length) {
    throw new Error('Selecciona al menos una pantalla')
  }

  const projectId =
    String(body.projectId ?? '').trim() || `demo-auto-${Date.now().toString(36)}`

  return {
    projectId,
    captureSource: body.captureSource === 'external' ? 'external' : 'stitch',
    niche,
    variantCount,
    storeTemplates: storeTemplates.length ? storeTemplates : ['html'],
    stitchProjectId: String(body.stitchProjectId ?? '').trim() || undefined,
    createStitchProject: body.createStitchProject !== false,
    screenPrompts: filteredPrompts,
    deviceType:
      body.deviceType === 'MOBILE' || body.deviceType === 'TABLET' ? body.deviceType : 'DESKTOP',
    seedUrls: Array.isArray(body.seedUrls) ? body.seedUrls.map(String) : undefined,
    navigateLinks: body.navigateLinks === true,
    publishToMarketplace: body.publishToMarketplace !== false,
    marketplaceTarget:
      body.marketplaceTarget === 'themeforest' ? 'themeforest' : 'templatemonster',
    publishMode: body.publishMode === 'auto' ? 'auto' : 'assist',
  }
}

export async function runAutoPipeline(
  config: AutoRunConfig,
  send: AutoRunSend,
): Promise<AutoRunState> {
  const runId = randomUUID()
  const state: AutoRunState = {
    runId,
    config,
    screens: [],
    variants: [],
  }

  if (config.captureSource === 'external') {
    send({
      phase: 'error',
      message: 'La fuente externa (crawl) no está disponible. Usa Stitch.',
    })
    throw new Error('captureSource external deshabilitado')
  }

  const ctx = await requireProjectFilesContext(config.projectId)
  const selectedIds = config.screenPrompts.map((s) => s.id)

  send({
    phase: 'generate-themes-prompts',
    message: 'Generando temas y prompts con IA…',
  })
  const themesAndPrompts = await generateThemesAndPrompts({
    niche: config.niche,
    selectedScreenIds: selectedIds,
  })
  state.themes = themesAndPrompts.themes
  state.selectedTheme = themesAndPrompts.selectedTheme
  state.screenPromptsUsed = themesAndPrompts.screenPrompts
  const projectTitle = await generateAutoProjectTitle({
    niche: config.niche,
    selectedThemeName: themesAndPrompts.selectedTheme.name,
  })
  state.projectTitle = projectTitle
  if (ctx.mode === 'db') {
    await ctx.supabase
      .from('projects')
      .update({
        name: projectTitle,
        description: 'Generado desde Auto (Stitch -> importacion -> templates).',
        framework: 'html',
        target_platforms: ['web'],
        design_phase: 'design',
        code_template: 'html',
      })
      .eq('id', config.projectId)
      .eq('user_id', ctx.user.id)
      .neq('status', 'deleted')
  }
  send({
    phase: 'generate-themes-prompts',
    message: `Tema seleccionado: ${themesAndPrompts.selectedTheme.name}. Proyecto: ${projectTitle}`,
  })

  await ctx.store.put(
    'spec/auto/themes-prompts.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        niche: config.niche,
        themes: themesAndPrompts.themes,
        selectedTheme: themesAndPrompts.selectedTheme,
        screenPrompts: themesAndPrompts.screenPrompts,
      },
      null,
      2,
    ),
  )

  const { stitchProjectId, screens } = await generateFullStitchSite({
    niche: config.niche,
    stitchProjectId: config.stitchProjectId,
    createStitchProject: config.createStitchProject,
    screenPrompts: themesAndPrompts.screenPrompts,
    selectedThemeName: themesAndPrompts.selectedTheme.name,
    deviceType: config.deviceType,
    send,
  })

  state.stitchProjectId = stitchProjectId
  state.screens = screens.map((s) => ({
    pageId: s.pageId,
    screenId: s.screenId,
    title: s.title,
    htmlPath: s.htmlPath,
    pngPath: s.pngPath,
  }))

  await importStitchSiteToProject({
    ctx,
    projectTitle,
    stitchProjectId,
    screens,
    send,
  })

  const templateVariants = await buildStoreTemplates({
    ctx,
    projectName: projectTitle,
    variantCount: config.variantCount,
    storeTemplates: config.storeTemplates,
    send,
  })

  const pageNames = screens.map((s) => s.title)

  for (const tv of templateVariants) {
    send({
      phase: 'generate-covers',
      message: `Portada Vertex ${tv.id}…`,
      variantId: tv.id,
      codeTemplate: tv.codeTemplate,
    })

    const cover = await generateMarketplaceCover({
      niche: config.niche,
      templateLabel: tv.codeTemplate,
      screens,
    })

    const coverPath = `assets/covers/${tv.id}/cover.png`
    const thumbPath = `assets/covers/${tv.id}/cover-thumb.png`
    await ctx.store.putMany([
      { path: coverPath, content: cover.pngBase64 },
      { path: thumbPath, content: cover.thumbBase64 },
    ])

    send({
      phase: 'generate-covers',
      message: `Portada ${cover.source}`,
      variantId: tv.id,
      coverSource: cover.source,
    })

    const listing = await generateListingMetadata({
      niche: config.niche,
      codeTemplate: tv.codeTemplate,
      projectName: projectTitle,
      pageNames,
    })
    listing.coverImagePath = coverPath

    if (config.publishToMarketplace) {
      send({ phase: 'package-marketplace', variantId: tv.id, message: 'Empaquetando ZIP…' })
      const installable = `${tv.exportPrefix}/preview/index.html`
      await packageTemplateMonsterZip({
        ctx,
        variantId: tv.id,
        codeTemplate: tv.codeTemplate,
        projectName: projectTitle,
        listing,
        coverPngBase64: cover.pngBase64,
        installablePath: installable,
      })

      const pub = await runTemplateMonsterPublisher({
        listing,
        packagePath: `spec/marketplace-listings/${tv.id}/package.zip`,
        publishMode: config.publishMode,
        send,
        variantId: tv.id,
        projectId: config.projectId,
      })

      await ctx.store.put(
        `spec/marketplace-listings/${tv.id}/submit-log.json`,
        JSON.stringify(
          {
            status: pub.status,
            message: pub.message,
            formFields: pub.formFields,
            draftUrl: pub.draftUrl,
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      )

      state.variants.push({
        id: tv.id,
        codeTemplate: tv.codeTemplate,
        exportPrefix: tv.exportPrefix,
        coverPath,
        listingPath: `spec/marketplace-listings/${tv.id}/listing.json`,
        packagePath: `spec/marketplace-listings/${tv.id}/package.zip`,
        status: 'ok',
        error: pub.status === 'prepared' ? pub.message : undefined,
      })
    } else {
      state.variants.push({
        id: tv.id,
        codeTemplate: tv.codeTemplate,
        exportPrefix: tv.exportPrefix,
        coverPath,
        status: 'ok',
      })
    }
  }

  await ctx.store.put(
    'spec/auto/run-state.json',
    JSON.stringify(state, null, 2),
  )

  send({
    phase: 'saved',
    message: 'Corrida completada',
    counts: {
      screens: screens.length,
      variants: state.variants.length,
    },
    artifactPath: 'spec/auto/run-state.json',
  })

  return state
}
