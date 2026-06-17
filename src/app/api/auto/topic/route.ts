import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { isVertexAIConfiguredAsync } from '@/lib/ai/config.server'
import { listAdminSettings } from '@/lib/platform/adminSettings.server'
import { resolveModelId } from '@/lib/ai/models'
import { resolveVertexPublisher } from '@/lib/ai/vertexAgentPlatform'
import {
  clampTopicMaxScreens,
  enrichTopicPromptForStitch,
  topicListSystemPrompt,
} from '@/lib/auto/topicStitchPrompt'
import { parseStitchDesignType } from '@/lib/auto/stitch/stitchDesignType'

const TOPIC_LIST_SIZE = 10
const TOPIC_GENERATION_ATTEMPTS = 3

function sanitizeTopic(raw: string): string {
  return raw.replace(/[`"'*#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function sanitizePrompt(raw: string): string {
  return raw.replace(/[`"'*#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 480)
}

function enrichTopicItem(
  item: TopicItem,
  maxScreens: number,
  designType: ReturnType<typeof parseStitchDesignType>,
): TopicItem {
  return {
    topic: item.topic,
    prompt: enrichTopicPromptForStitch({
      prompt: item.prompt,
      maxScreens,
      designType,
    }),
  }
}

type TopicItem = { topic: string; prompt: string }
type DbTopicItem = { id: string; topic: string; prompt: string }
type DbTopicRow = DbTopicItem & { status: 'pending' | 'done' }
const AUTO_TOPIC_LLM_MODEL_SETTING_KEY = 'auto_topic_llm_model'

async function generateTopicItems(
  modelId: string,
  blockedTopics: string[],
  maxScreens: number,
): Promise<TopicItem[]> {
  const blockedSection = blockedTopics.length
    ? `\nNo repitas ni propongas ninguno de estos topics ya usados:\n${blockedTopics
        .slice(0, 120)
        .map((b) => `- ${b}`)
        .join('\n')}`
    : ''
  const text = await generateAgentPlatformText(
    `Propón ${TOPIC_LIST_SIZE} topics distintos para webs y tiendas online modernas y vendibles. Cada prompt debe dejar claro el tipo de producto (tienda, blog, marketplace, etc.).${blockedSection}`,
    {
      systemInstruction: topicListSystemPrompt(maxScreens),
      model: modelId,
      preferRealtime: true,
      responseMimeType: 'application/json',
      temperature: 0.9,
      maxOutputTokens: 4096,
    },
  )
  const designType = parseStitchDesignType('web')
  return parseTopicList(text, maxScreens)
    .filter((item, idx, arr) => arr.findIndex((x) => x.topic === item.topic) === idx)
    .slice(0, TOPIC_LIST_SIZE)
    .map((item) => enrichTopicItem(item, maxScreens, designType))
}

async function resolveAutoTopicModelId(requestedModelId?: string): Promise<string> {
  const requested = String(requestedModelId ?? '').trim()
  if (requested) {
    const resolved = resolveModelId(requested, { geminiEnabled: true })
    if (resolveVertexPublisher(resolved) === 'google') return resolved
  }
  try {
    const settings = await listAdminSettings()
    const fromDb = String(settings[AUTO_TOPIC_LLM_MODEL_SETTING_KEY] ?? '').trim()
    if (fromDb) {
      const resolved = resolveModelId(fromDb, { geminiEnabled: true })
      if (resolveVertexPublisher(resolved) === 'google') return resolved
    }
  } catch {
    // fallback local/env
  }
  return resolveModelId('gemini-2.5-flash-lite', { geminiEnabled: true })
}

function defaultPromptForTopic(topic: string, maxScreens: number): string {
  return enrichTopicPromptForStitch({
    prompt: `Diseña una web moderna para ${topic} con enfoque comercial, navegación clara, contenido optimizado y estética coherente con la marca.`,
    maxScreens,
    designType: 'web',
  })
}

function parseTopicPatterns(raw: string, maxScreens: number): TopicItem[] {
  const out: TopicItem[] = []
  const pairRegex = /["']?(?:topic|brief)["']?\s*:\s*["']([^"']+)["'][\s\S]*?["']?prompt["']?\s*:\s*["']([^"']+)["']/gi
  for (const match of raw.matchAll(pairRegex)) {
    const topic = sanitizeTopic(match[1] ?? '')
    const prompt = sanitizePrompt(match[2] ?? '')
    if (topic && prompt) out.push({ topic, prompt })
  }
  if (out.length) return out

  const listMatch = raw.match(/topics?\s*:\s*\[([\s\S]*?)\]/i)?.[1] ?? ''
  const strings = Array.from(listMatch.matchAll(/["']([^"']+)["']/g))
    .map((m) => sanitizeTopic(m[1] ?? ''))
    .filter(Boolean)
  return strings.map((topic) => ({ topic, prompt: defaultPromptForTopic(topic, maxScreens) }))
}

function parseTopicList(raw: string, maxScreens: number): TopicItem[] {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fence ?? raw).trim()
  const objectSlice = (() => {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) return candidate.slice(start, end + 1)
    return candidate
  })()
  try {
    const parsed = JSON.parse(objectSlice) as {
      items?: Array<Record<string, unknown>>
      topics?: unknown[]
    }
    if (Array.isArray(parsed.items)) {
      const items = parsed.items
        .map((row) => ({
          topic: sanitizeTopic(String(row.topic ?? row.brief ?? '')),
          prompt: sanitizePrompt(String(row.prompt ?? '')),
        }))
        .filter((row) => row.topic && row.prompt)
      if (items.length) return items
    }
    if (Array.isArray(parsed.topics)) {
      return parsed.topics
        .map((x) => sanitizeTopic(String(x)))
        .filter(Boolean)
        .map((topic) => ({ topic, prompt: defaultPromptForTopic(topic, maxScreens) }))
    }
  } catch {
    const patternParsed = parseTopicPatterns(candidate, maxScreens)
    if (patternParsed.length) return patternParsed
  }
  const designType = parseStitchDesignType('web')
  return candidate
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, ''))
    .filter((line) => !/^\s*(json|items?|topics?|[\[\]{}:,]+)\s*$/i.test(line))
    .map((line) => sanitizeTopic(line))
    .filter(Boolean)
    .map((topic) => ({ topic, prompt: defaultPromptForTopic(topic, maxScreens) }))
    .map((item) => enrichTopicItem(item, maxScreens, designType))
}

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    let authContext: Awaited<ReturnType<typeof requireUser>> | null = null
    try {
      authContext = await requireUser()
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e
    }
    if (!(await isVertexAIConfiguredAsync())) {
      throw new ApiError(
        503,
        'Vertex AI no configurado en la base de datos (admin_settings: google_cloud_credentials).',
      )
    }
    const reqBody = (await request.json().catch(() => ({}))) as {
      modelId?: unknown
      maxScreens?: unknown
    }
    const modelId = await resolveAutoTopicModelId(String(reqBody.modelId ?? '').trim() || undefined)
    const maxScreens = clampTopicMaxScreens(reqBody.maxScreens)

    const generatedItems = await generateTopicItems(modelId, [], maxScreens)
    if (generatedItems.length < TOPIC_LIST_SIZE) {
      throw new ApiError(502, `Vertex AI no devolvió ${TOPIC_LIST_SIZE} elementos válidos`)
    }

    if (!authContext) {
      const ephemeral = generatedItems.map((item, idx) => ({
        id: `ephemeral-${idx + 1}`,
        topic: item.topic,
        prompt: item.prompt,
      }))
      return NextResponse.json({ items: ephemeral, modelId, persisted: false })
    }

    const { data: existingRows, error: existingErr } = await authContext.supabase
      .from('auto_topic_items')
      .select('id, topic, prompt, status')
      .eq('user_id', authContext.user.id)
    if (existingErr) throw new ApiError(500, existingErr.message)

    const existingByTopic = new Map<string, DbTopicRow>()
    for (const row of (existingRows ?? []) as DbTopicRow[]) {
      existingByTopic.set(row.topic, row)
    }

    const blockedTopics = Array.from(existingByTopic.values())
      .filter((row) => row.status === 'done')
      .map((row) => row.topic)

    let insertCandidates = generatedItems.filter((item) => !existingByTopic.has(item.topic))
    for (let attempt = 1; attempt < TOPIC_GENERATION_ATTEMPTS && insertCandidates.length === 0; attempt += 1) {
      const retried = await generateTopicItems(modelId, blockedTopics, maxScreens)
      insertCandidates = retried.filter((item) => !existingByTopic.has(item.topic))
    }

    const rowsToInsert = insertCandidates
      .filter((item) => !existingByTopic.has(item.topic))
      .map((item) => ({
        user_id: authContext!.user.id,
        topic: item.topic,
        prompt: item.prompt,
        status: 'pending' as const,
        done_at: null as string | null,
      }))

    if (rowsToInsert.length) {
      const { error: insertErr } = await authContext.supabase
        .from('auto_topic_items')
        .insert(rowsToInsert)
      if (insertErr) throw new ApiError(500, insertErr.message)
    }

    const { data: pendingRows, error: pendingErr } = await authContext.supabase
      .from('auto_topic_items')
      .select('id, topic, prompt')
      .eq('user_id', authContext.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (pendingErr) throw new ApiError(500, pendingErr.message)

    const { data: savedRows, error: savedErr } = await authContext.supabase
      .from('auto_topic_items')
      .select('id, topic, prompt, status')
      .eq('user_id', authContext.user.id)
      .order('created_at', { ascending: true })
    if (savedErr) throw new ApiError(500, savedErr.message)

    return NextResponse.json({
      items: (pendingRows ?? []) as DbTopicItem[],
      savedItems: (savedRows ?? []) as DbTopicRow[],
      modelId,
      persisted: true,
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStreamUser()
    let authContext: Awaited<ReturnType<typeof requireUser>> | null = null
    try {
      authContext = await requireUser()
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e
    }
    const body = (await request.json().catch(() => ({}))) as {
      itemIds?: unknown[]
      clearAll?: unknown
      clearDone?: unknown
    }
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.map((x) => String(x).trim()).filter(Boolean)
      : []
    const clearAll = body.clearAll === true
    const clearDone = body.clearDone === true
    if (!itemIds.length && !clearAll && !clearDone) {
      throw new ApiError(400, 'itemIds, clearAll o clearDone es requerido')
    }
    if (clearAll && clearDone) {
      throw new ApiError(400, 'clearAll y clearDone no pueden usarse a la vez')
    }

    if (!authContext) {
      return NextResponse.json({ ok: true, persisted: false })
    }

    const { supabase, user } = authContext
    let query = supabase.from('auto_topic_items').delete().eq('user_id', user.id)

    if (clearAll) {
      query = query.eq('status', 'pending')
    } else if (clearDone) {
      query = query.eq('status', 'done')
    } else {
      query = query.eq('status', 'pending').in('id', itemIds)
    }
    const { error } = await query
    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser()
    const modelId = await resolveAutoTopicModelId()
    const { data: pendingRows, error: pendingErr } = await supabase
      .from('auto_topic_items')
      .select('id, topic, prompt')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (pendingErr) throw new ApiError(500, pendingErr.message)

    const { data: savedRows, error: savedErr } = await supabase
      .from('auto_topic_items')
      .select('id, topic, prompt, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (savedErr) throw new ApiError(500, savedErr.message)

    return NextResponse.json({
      items: (pendingRows ?? []) as DbTopicItem[],
      savedItems: (savedRows ?? []) as DbTopicRow[],
      modelId,
    })
  } catch (e) {
    return jsonError(e)
  }
}
