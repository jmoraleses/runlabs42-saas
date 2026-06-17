import { ApiError, jsonError } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createAdminRouteClient } from '@/lib/supabase/adminRouteClient'
import type { createClient } from '@/lib/supabase/server'
import {
  CURSOR_VERTEX_MODELS,
  DEEPSEEK_VERTEX_MODELS,
  LLAMA_VERTEX_MODELS,
  modelPriceSortKey,
  MODEL_CATALOG,
  OPENAI_VERTEX_MODELS,
} from '@/lib/ai/catalog'
import { resolveCatalogModelForVertexId } from '@/lib/ai/catalogVertexResolve'
import { getVertexAICredentials } from '@/lib/ai/config.server'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import {
  loadModelMenuVisibilityFromDb,
  saveModelMenuVisibilityToDb,
} from '@/lib/platform/adminModelMenuVisibility.server'
import {
  parseModelMenuVisibility,
  type ModelMenuVisibility,
} from '@/lib/ai/modelMenuVisibility'

export { dynamic } from '@/lib/api/routeSegment'

const ADMIN_PRICING_SNAPSHOT_KEY = 'model_pricing_snapshot'

type PricingSnapshotRow = {
  id: string
  labelKey?: string
  displayName?: string
  description?: string
  provider: string
  vendor: string
  category: string
  status: 'ga' | 'preview'
  inputPerM: number | null
  outputPerM: number | null
  perImage: number | null
  perSecondVideo: number | null
  totalPerM: number | null
  /** ID de catálogo del que se tomó el precio (si difiere del ID Vertex). */
  priceCatalogId?: string
  priceMatch?: 'exact' | 'alias' | 'family' | 'none'
}

type VertexPublisher = 'google' | 'anthropic' | 'openai' | 'cursor' | 'deepseek' | 'meta'

const PUBLISHERS: VertexPublisher[] = [
  'google',
  'anthropic',
  'openai',
  'cursor',
  'deepseek',
  'meta',
]

function inferCategory(modelId: string): PricingSnapshotRow['category'] {
  const id = modelId.toLowerCase()
  if (id.includes('embedding')) return 'embedding'
  if (id.includes('image') || id.includes('imagen')) return 'image'
  if (id.includes('veo') || id.includes('video')) return 'video'
  return 'text'
}

function inferStatus(modelId: string): PricingSnapshotRow['status'] {
  const id = modelId.toLowerCase()
  return id.includes('preview') ? 'preview' : 'ga'
}

function toProvider(vendor: VertexPublisher): string {
  if (vendor === 'google') return 'gemini'
  if (vendor === 'meta') return 'meta'
  return vendor
}

const PARTNER_PUBLISHERS = new Set<VertexPublisher>(['openai', 'cursor', 'deepseek', 'meta'])

function locationsForPublisher(
  publisher: VertexPublisher,
  baseLocations: string[],
): string[] {
  if (!PARTNER_PUBLISHERS.has(publisher)) return baseLocations
  return [...new Set([...baseLocations, 'global'])]
}

type PartnerCatalogSeed = {
  id: string
  labelKey?: string
  vendor: VertexPublisher
  status?: 'ga' | 'preview'
}

function partnerCatalogSeeds(): PartnerCatalogSeed[] {
  const seeds: PartnerCatalogSeed[] = []
  for (const m of OPENAI_VERTEX_MODELS) {
    if (!m.available) continue
    seeds.push({ id: m.id, labelKey: m.labelKey, vendor: 'openai', status: 'ga' })
  }
  for (const m of DEEPSEEK_VERTEX_MODELS) {
    if (!m.available) continue
    seeds.push({ id: m.id, labelKey: m.labelKey, vendor: 'deepseek', status: 'ga' })
  }
  for (const m of CURSOR_VERTEX_MODELS) {
    if (!m.available) continue
    seeds.push({ id: m.id, labelKey: 'ed.modelComposer25', vendor: 'cursor', status: 'ga' })
  }
  for (const m of LLAMA_VERTEX_MODELS) {
    if (!m.available) continue
    seeds.push({ id: m.id, labelKey: m.labelKey, vendor: 'meta', status: m.status })
  }
  return seeds
}

function upsertPricingRow(
  rows: Map<string, PricingSnapshotRow>,
  modelId: string,
  vendor: VertexPublisher,
  opts?: {
    labelKey?: string
    displayName?: string
    description?: string
    status?: 'ga' | 'preview'
  },
): void {
  if (rows.has(modelId)) return
  const resolved = resolveCatalogModelForVertexId(modelId)
  const cat = resolved?.model
  const inputPerM = cat?.pricing.inputPerM ?? null
  const outputPerM = cat?.pricing.outputPerM ?? null
  const perImage = cat?.pricing.perImage ?? null
  const perSecondVideo = cat?.pricing.perSecondVideo ?? null
  const totalPerM =
    inputPerM != null || outputPerM != null ? (inputPerM ?? 0) + (outputPerM ?? 0) : null
  rows.set(modelId, {
    id: modelId,
    labelKey: opts?.labelKey ?? cat?.labelKey,
    displayName: opts?.displayName ?? cat?.labelKey ?? modelId,
    description: opts?.description,
    provider: cat?.provider ?? toProvider(vendor),
    vendor: cat?.vendor ?? vendor,
    category: cat?.category ?? inferCategory(modelId),
    status: opts?.status ?? cat?.status ?? inferStatus(modelId),
    inputPerM,
    outputPerM,
    perImage,
    perSecondVideo,
    totalPerM,
    priceCatalogId: resolved?.catalogId,
    priceMatch: resolved?.match ?? (cat ? 'exact' : 'none'),
  })
}

function mergePartnerCatalogModels(rows: Map<string, PricingSnapshotRow>): void {
  for (const seed of partnerCatalogSeeds()) {
    upsertPricingRow(rows, seed.id, seed.vendor, {
      labelKey: seed.labelKey,
      status: seed.status,
    })
  }
}

function snapshotRowsWithPartners(rows: PricingSnapshotRow[]): PricingSnapshotRow[] {
  const map = new Map(rows.map((row) => [row.id, { ...row }]))
  mergePartnerCatalogModels(map)
  return sortPricingRows([...map.values()])
}

function rowSortKey(row: PricingSnapshotRow): number {
  if (row.totalPerM != null) return row.totalPerM
  if (row.perImage != null) return row.perImage
  if (row.perSecondVideo != null) return row.perSecondVideo
  return Number.POSITIVE_INFINITY
}

function sortPricingRows(rows: PricingSnapshotRow[]): PricingSnapshotRow[] {
  return [...rows].sort((a, b) => {
    const aSort = rowSortKey(a)
    const bSort = rowSortKey(b)
    if (aSort !== bSort) return aSort - bSort
    const modelA = MODEL_CATALOG.find((m) => m.id === a.id)
    const modelB = MODEL_CATALOG.find((m) => m.id === b.id)
    if (!modelA || !modelB) return a.id.localeCompare(b.id)
    return modelPriceSortKey(modelA) - modelPriceSortKey(modelB)
  })
}

async function fetchPublisherModels(
  token: string,
  projectId: string,
  location: string,
  publisher: VertexPublisher,
): Promise<Array<{ id: string; displayName: string; description?: string }>> {
  const models: Array<{ id: string; displayName: string; description?: string }> = []
  let pageToken = ''
  let baseUrl: string | null = null
  const candidateBaseUrls = [
    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models`,
    location !== 'global'
      ? `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models`
      : null,
    `https://aiplatform.googleapis.com/v1/publishers/${publisher}/models`,
    location !== 'global'
      ? `https://${location}-aiplatform.googleapis.com/v1/publishers/${publisher}/models`
      : null,
    `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/${publisher}/models`,
    location !== 'global'
      ? `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/${publisher}/models`
      : null,
    `https://aiplatform.googleapis.com/v1beta1/publishers/${publisher}/models`,
    location !== 'global'
      ? `https://${location}-aiplatform.googleapis.com/v1beta1/publishers/${publisher}/models`
      : null,
  ].filter(Boolean) as string[]

  let lastError = ''

  async function fetchPage(urlStr: string) {
    const url = new URL(urlStr)
    // En listados de Publisher Models, 500 puede devolver INVALID_ARGUMENT (400) en algunos proyectos.
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    return fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  }

  if (!baseUrl) {
    for (const candidate of candidateBaseUrls) {
      try {
        const probe = await fetchPage(candidate)
        if (probe.ok) {
          baseUrl = candidate
          const json = (await probe.json()) as {
            models?: Array<{ name?: string; displayName?: string; description?: string }>
            publisherModels?: Array<{ name?: string; displayName?: string; description?: string }>
            nextPageToken?: string
          }
          const rows = json.models ?? json.publisherModels ?? []
          for (const m of rows) {
            const full = (m.name ?? '').trim()
            if (!full.includes('/models/')) continue
            const id = full.split('/models/').at(-1)?.trim()
            if (!id) continue
            models.push({
              id,
              displayName: (m.displayName ?? id).trim(),
              description: (m.description ?? '').trim() || undefined,
            })
          }
          pageToken = (json.nextPageToken ?? '').trim()
          break
        }
        lastError = `${probe.status} ${probe.statusText}`
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
  }

  if (!baseUrl) {
    throw new Error(
      `No se pudo listar ${publisher} en ${location}${lastError ? ` (${lastError})` : ''}`,
    )
  }

  for (let i = 0; i < 10; i++) {
    if (i === 0 && !pageToken) continue
    const res = await fetchPage(baseUrl)
    if (!res.ok) break
    const json = (await res.json()) as {
      models?: Array<{ name?: string; displayName?: string; description?: string }>
      publisherModels?: Array<{ name?: string; displayName?: string; description?: string }>
      nextPageToken?: string
    }
    const rows = json.models ?? json.publisherModels ?? []
    for (const m of rows) {
      const full = (m.name ?? '').trim()
      if (!full.includes('/models/')) continue
      const id = full.split('/models/').at(-1)?.trim()
      if (!id) continue
      models.push({
        id,
        displayName: (m.displayName ?? id).trim(),
        description: (m.description ?? '').trim() || undefined,
      })
    }
    pageToken = (json.nextPageToken ?? '').trim()
    if (!pageToken) break
  }
  return models
}

async function buildPricingRowsFromVertex(): Promise<PricingSnapshotRow[]> {
  const creds = getVertexAICredentials()
  if (!creds) throw new ApiError(400, 'Vertex AI no configurado')
  const token = await getVertexBearerToken()
  const locations = [...new Set([creds.location, 'us-central1', 'us-east5'])].filter(
    (loc): loc is string => Boolean(loc && loc !== 'global'),
  )
  const rows = new Map<string, PricingSnapshotRow>()
  const failures: string[] = []

  for (const publisher of PUBLISHERS) {
    for (const location of locationsForPublisher(publisher, locations)) {
      let models: Array<{ id: string; displayName: string; description?: string }> = []
      try {
        models = await fetchPublisherModels(token, creds.projectId, location, publisher)
      } catch (e) {
        failures.push(
          `${publisher}@${location}: ${e instanceof Error ? e.message : String(e)}`,
        )
        continue
      }
      for (const m of models) {
        upsertPricingRow(rows, m.id, publisher, {
          displayName: m.displayName,
          description: m.description,
        })
      }
    }
  }

  // OpenAI / DeepSeek MaaS y otros partners: a menudo no aparecen en list publishers o solo en global.
  mergePartnerCatalogModels(rows)

  const result = sortPricingRows([...rows.values()])
  if (result.length === 0) {
    const details = failures.slice(0, 6).join(' | ')
    throw new ApiError(
      502,
      `Vertex AI no devolvió modelos para ningún publisher/región.${details ? ` ${details}` : ''}`,
    )
  }
  return result
}

function createSnapshot(rows: PricingSnapshotRow[], source: string) {
  return {
    updatedAt: new Date().toISOString(),
    source,
    rows,
  }
}

async function persistPricingRowsTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: PricingSnapshotRow[],
): Promise<void> {
  const nowIso = new Date().toISOString()
  const payload = rows.map((row) => ({
    model_id: row.id,
    label_key: row.labelKey ?? null,
    display_name: row.displayName ?? null,
    provider: row.provider,
    vendor: row.vendor,
    category: row.category,
    status: row.status,
    input_per_m: row.inputPerM,
    output_per_m: row.outputPerM,
    per_image: row.perImage,
    per_second_video: row.perSecondVideo,
    total_per_m: row.totalPerM,
    source: 'vertex',
    last_synced_at: nowIso,
  }))

  const syncResult = await supabase.rpc('admin_sync_model_pricing_rows', {
    p_rows: payload,
  })
  if (syncResult.error && isMissingSupabaseRpc(syncResult.error, 'admin_sync_model_pricing_rows')) {
    const upsertResult = await supabase.rpc('admin_upsert_model_pricing_rows', {
      p_rows: payload,
    })
    if (upsertResult.error) {
      throw new ApiError(
        500,
        `No se pudo persistir tabla de modelos: ${upsertResult.error.message}. Aplica la migración 025_admin_model_pricing_rpc.sql en Supabase.`,
      )
    }
    return
  }
  if (syncResult.error) {
    throw new ApiError(
      500,
      `No se pudo persistir tabla de modelos: ${syncResult.error.message}. Aplica las migraciones 025 y 027 en Supabase.`,
    )
  }
}

function isMissingSupabaseRpc(error: { message?: string }, fnName: string): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('could not find the function') && msg.includes(fnName.toLowerCase())
}

function pricingRowsToSnapshot(
  rows: PricingSnapshotRow[],
  updatedAt: string | null,
  source: string,
) {
  return {
    snapshot: {
      updatedAt,
      source,
      rows,
    },
  }
}

type DbPricingRow = {
  model_id: string
  label_key?: string | null
  display_name?: string | null
  provider: string
  vendor: string
  category: string
  status: string
  input_per_m?: number | null
  output_per_m?: number | null
  per_image?: number | null
  per_second_video?: number | null
  total_per_m?: number | null
  last_synced_at?: string | null
}

function mapDbPricingRows(tableRows: DbPricingRow[]): {
  rows: PricingSnapshotRow[]
  updatedAt: string | null
} {
  const rows = snapshotRowsWithPartners(
    tableRows.map((row) => ({
      id: row.model_id,
      labelKey: row.label_key ?? undefined,
      displayName: row.display_name ?? undefined,
      provider: row.provider,
      vendor: row.vendor,
      category: row.category,
      status: row.status as PricingSnapshotRow['status'],
      inputPerM: row.input_per_m ?? null,
      outputPerM: row.output_per_m ?? null,
      perImage: row.per_image ?? null,
      perSecondVideo: row.per_second_video ?? null,
      totalPerM: row.total_per_m ?? null,
    })),
  )
  return {
    rows,
    updatedAt: tableRows[0]?.last_synced_at ?? null,
  }
}

async function loadPricingRowsFromDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ rows: PricingSnapshotRow[]; updatedAt: string | null; source: string }> {
  const { data: rpcPayload, error: rpcError } = await supabase.rpc('admin_list_model_pricing_rows')
  if (!rpcError) {
    const rpcRows = Array.isArray(rpcPayload) ? (rpcPayload as DbPricingRow[]) : []
    if (rpcRows.length > 0) {
      const mapped = mapDbPricingRows(rpcRows)
      return { ...mapped, source: 'supabase_table' }
    }
  } else if (!isMissingSupabaseRpc(rpcError, 'admin_list_model_pricing_rows')) {
    throw new ApiError(500, rpcError.message)
  }

  const { data: tableRows, error: tableError } = await supabase
    .from('admin_model_pricing')
    .select(
      'model_id,label_key,display_name,provider,vendor,category,status,input_per_m,output_per_m,per_image,per_second_video,total_per_m,last_synced_at',
    )
    .order('last_synced_at', { ascending: false })
  if (tableError) throw new ApiError(500, tableError.message)

  if (Array.isArray(tableRows) && tableRows.length > 0) {
    const mapped = mapDbPricingRows(tableRows as DbPricingRow[])
    return { ...mapped, source: 'supabase_table' }
  }

  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', ADMIN_PRICING_SNAPSHOT_KEY)
    .maybeSingle()
  if (error) throw new ApiError(500, error.message)
  const value = (data?.value ?? null) as { updatedAt?: string; source?: string; rows?: unknown } | null
  if (value && Array.isArray(value.rows)) {
    return {
      rows: snapshotRowsWithPartners(value.rows as PricingSnapshotRow[]),
      updatedAt: value.updatedAt ?? null,
      source: value.source ?? 'vertex',
    }
  }

  return { rows: [], updatedAt: null, source: 'none' }
}

export async function GET() {
  try {
    await requireAdmin()
    const supabase = await createAdminRouteClient()
    const { rows, updatedAt, source } = await loadPricingRowsFromDb(supabase)
    const modelIds = rows.map((r) => r.id)
    const visibility = await loadModelMenuVisibilityFromDb(supabase, modelIds)
    return Response.json({
      ...pricingRowsToSnapshot(rows, updatedAt, source),
      visibility,
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = (await request.json()) as { visibility?: ModelMenuVisibility }
    if (!body.visibility || typeof body.visibility !== 'object') {
      throw new ApiError(400, 'visibility requerido')
    }
    const supabase = await createAdminRouteClient()
    const { rows } = await loadPricingRowsFromDb(supabase)
    const payload = parseModelMenuVisibility(body.visibility, rows.map((r) => r.id))
    await saveModelMenuVisibilityToDb(supabase, payload)
    return Response.json({ ok: true, visibility: payload })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST() {
  try {
    await requireAdmin()
    const supabase = await createAdminRouteClient()
    const rows = await buildPricingRowsFromVertex()
    await persistPricingRowsTable(supabase, rows)
    const snapshot = createSnapshot(rows, 'vertex')
    const { error } = await supabase.rpc('admin_upsert_setting', {
      p_key: ADMIN_PRICING_SNAPSHOT_KEY,
      p_value: snapshot,
    })
    if (error) throw new ApiError(500, error.message)
    const visibility = await loadModelMenuVisibilityFromDb(
      supabase,
      rows.map((r) => r.id),
    )
    return Response.json({ ok: true, snapshot, visibility })
  } catch (e) {
    return jsonError(e)
  }
}
