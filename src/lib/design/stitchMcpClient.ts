/**
 * Cliente ligero para Google Stitch MCP (HTTP).
 * Autenticación de Stitch por API key dedicada (sin Google Cloud service account).
 */

export type StitchMcpError = { code?: number; message: string }
export class StitchApiUnavailableError extends Error {}

export type StitchScreenSummary = {
  name: string
  title?: string
  width?: number
  height?: number
}

export type StitchProjectSummary = {
  /** Null si el listado lateral no expone el ID (se resuelve al descargar). */
  projectId: string | null
  title: string
  updateTime?: string
  createTime?: string
  screenCount?: number | null
  screenCountStatus?: 'ok' | 'error' | 'unavailable'
  screenCountError?: string
}

export type StitchGenerateScreenResult = {
  projectId: string
  sessionId?: string
  raw: Record<string, unknown>
  designSystemId?: string
}

export type StitchScreenAssets = {
  screenId: string
  title?: string
  html: string
  png: Buffer
  htmlDownloadUrl: string
  screenshotDownloadUrl: string
}

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp'

function getStitchApiKey(): string {
  const key = process.env.STITCH_API_KEY?.trim()
  if (!key) {
    throw new Error('Falta STITCH_API_KEY. Configúrala en .env.local para usar Stitch.')
  }
  return key
}

const STITCH_ACCOUNT_EMAIL = process.env.STITCH_ACCOUNT_EMAIL?.trim() || 'runlabs42@gmail.com'

async function getStitchAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = getStitchApiKey()
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-goog-api-key': apiKey,
  }
}

export async function getStitchAccountEmail(): Promise<string | null> {
  return STITCH_ACCOUNT_EMAIL
}

export async function isStitchApiConfigured(): Promise<boolean> {
  try {
    await getStitchAuthHeaders()
    return true
  } catch {
    return false
  }
}

export async function stitchMcpCall<T extends Record<string, unknown>>(
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const headers = await getStitchAuthHeaders()
  const hasArgs = Object.keys(args).length > 0
  const res = await fetch(STITCH_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: hasArgs ? { name: toolName, arguments: args } : { name: toolName },
    }),
  })
  const json = (await res.json()) as {
    error?: StitchMcpError
    result?: { content?: Array<{ text?: string }> }
  }
  if (json.error) {
    throw new Error(
      `Stitch ${toolName}: ${json.error.message ?? JSON.stringify(json.error)}`,
    )
  }
  const text = json.result?.content?.[0]?.text
  if (!text) throw new Error(`Stitch ${toolName}: respuesta vacía`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Stitch ${toolName}: JSON inválido — ${text.slice(0, 200)}`)
  }
}

export function normalizeStitchProjectId(projectId: string): string {
  return projectId.trim().replace(/^projects\//, '').replace(/\/+$/, '')
}

export function normalizeStitchScreenId(screenId: string): string {
  return screenId.replace(/^.*\/screens\//, '')
}

export async function createStitchProject(title: string): Promise<string> {
  const data = await stitchMcpCall<{ name?: string; project?: { name?: string } }>(
    'create_project',
    { title },
  )
  const name = data.project?.name ?? data.name
  if (!name) throw new Error('create_project sin id')
  return normalizeStitchProjectId(name)
}

export type GenerateStitchScreenOpts = {
  deviceType?: 'DESKTOP' | 'MOBILE' | 'TABLET'
  modelId?: 'GEMINI_3_FLASH' | 'GEMINI_3_1_PRO'
  designSystem?: string
}

/** Genera una pantalla en Stitch (puede tardar 1–2 min). */
export async function generateStitchScreen(
  projectId: string,
  prompt: string,
  opts: GenerateStitchScreenOpts = {},
): Promise<StitchGenerateScreenResult> {
  const pid = normalizeStitchProjectId(projectId)
  const raw = await stitchMcpCall<Record<string, unknown>>(
    'generate_screen_from_text',
    {
      projectId: pid,
      prompt,
      deviceType: opts.deviceType ?? 'DESKTOP',
      ...(opts.modelId ? { modelId: opts.modelId } : {}),
      ...(opts.designSystem ? { designSystem: opts.designSystem } : {}),
    },
  )

  let designSystemId: string | undefined
  const components = raw.outputComponents as Array<Record<string, unknown>> | undefined
  if (Array.isArray(components)) {
    for (const c of components) {
      const ds = c.designSystem as { name?: string } | undefined
      if (ds?.name) designSystemId = ds.name
    }
  }

  return {
    projectId: String(raw.projectId ?? pid),
    sessionId: raw.sessionId as string | undefined,
    raw,
    designSystemId,
  }
}

export async function listStitchScreens(
  projectId: string,
): Promise<StitchScreenSummary[]> {
  const pid = normalizeStitchProjectId(projectId)
  const name = `projects/${pid}`
  const attempts: Array<Record<string, unknown>> = [
    { projectId: pid },
    { projectId: name },
    { project: name },
    { name },
  ]

  let lastError = 'list_screens sin respuesta válida'
  let apiUnavailable = false
  for (const args of attempts) {
    try {
      const data = await stitchMcpCall<Record<string, unknown>>('list_screens', args)
      const candidate = (
        data.screens ??
        data.items ??
        data.results ??
        data.data ??
        data.output
      ) as unknown
      if (Array.isArray(candidate)) {
        return candidate as StitchScreenSummary[]
      }
      if (candidate && typeof candidate === 'object') {
        const nested = candidate as Record<string, unknown>
        const nestedArray = (
          nested.screens ??
          nested.items ??
          nested.results ??
          nested.data
        ) as unknown
        if (Array.isArray(nestedArray)) {
          return nestedArray as StitchScreenSummary[]
        }
      }
      // En este entorno Stitch responde "{}" incluso para proyectos con pantallas.
      if (Object.keys(data).length === 0) {
        apiUnavailable = true
        continue
      }
      // Algunas respuestas válidas no tienen pantallas y devuelven colección vacía no estándar.
      return []
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      lastError = message
      if (
        message.includes('JSON inválido — Request contains an invalid argument.') ||
        message.includes('JSON inválido — Requested entity was not found.') ||
        message.includes('JSON inválido — The service is currently unavailable.')
      ) {
        if (message.includes('The service is currently unavailable.')) {
          apiUnavailable = true
        }
        continue
      }
    }
  }
  if (apiUnavailable) {
    throw new StitchApiUnavailableError(`No disponible por API para proyecto ${pid}`)
  }
  throw new Error(`No se pudo listar pantallas para ${pid}: ${lastError}`)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.min(concurrency, items.length || 1))
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: size }, async () => {
    while (true) {
      const idx = next++
      if (idx >= items.length) return
      out[idx] = await mapper(items[idx]!, idx)
    }
  })
  await Promise.all(workers)
  return out
}

async function countProjectScreensSafe(
  projectId: string,
): Promise<{ count: number | null; error?: string; unavailable?: boolean }> {
  const pid = normalizeStitchProjectId(projectId)

  const countFromUnknown = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.floor(value)
    }
    if (Array.isArray(value)) return value.length
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const directKeys = [
        'screenCount',
        'screensCount',
        'screen_count',
        'screens_count',
        'totalScreens',
        'screenTotal',
        'numScreens',
      ]
      for (const key of directKeys) {
        const nested = countFromUnknown(obj[key])
        if (nested !== null) return nested
      }
      const screenCollections = ['screens', 'items', 'results', 'data']
      for (const key of screenCollections) {
        const nested = countFromUnknown(obj[key])
        if (nested !== null) return nested
      }
    }
    return null
  }

  const countFromGetProject = async (): Promise<number | null> => {
    const name = `projects/${pid}`
    const attempts: Array<Record<string, unknown>> = [
      { name },
      { projectId: pid },
      { projectId: name },
      { project: name },
    ]
    for (const args of attempts) {
      try {
        const data = await stitchMcpCall<Record<string, unknown>>('get_project', args)
        const fromRoot = countFromUnknown(data)
        if (fromRoot !== null) return fromRoot
        const projectLike = data.project
        const fromProject = countFromUnknown(projectLike)
        if (fromProject !== null) return fromProject
      } catch {
        // Seguimos con otras variantes / fallback.
      }
    }
    return null
  }

  try {
    const fromProject = await countFromGetProject()
    if (fromProject !== null) return { count: fromProject }
  } catch {
    // Fallback a list_screens.
  }

  try {
    const screens = await listStitchScreens(projectId)
    return { count: screens.length }
  } catch (e) {
    if (e instanceof StitchApiUnavailableError) {
      return {
        count: null,
        unavailable: true,
      }
    }
    return {
      count: null,
      error: e instanceof Error ? e.message : 'Error desconocido consultando pantallas',
    }
  }
}

export async function listStitchProjects(
  limit = 50,
  opts?: { includeScreenCount?: boolean },
): Promise<StitchProjectSummary[]> {
  const headers = await getStitchAuthHeaders()
  const bounded = Math.min(Math.max(limit, 1), 200)
  const payloads: Array<Record<string, unknown>> = [
    {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'list_projects', arguments: { filter: 'view=owned' } },
    },
    {
      jsonrpc: '2.0',
      id: Date.now() + 1,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} },
    },
    {
      jsonrpc: '2.0',
      id: Date.now() + 2,
      method: 'tools/call',
      params: { name: 'list_projects' },
    },
    {
      jsonrpc: '2.0',
      id: Date.now() + 3,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: { pageSize: bounded } },
    },
  ]

  let rawProjects: Array<Record<string, unknown>> = []
  let lastError: string | null = null

  for (const body of payloads) {
    const res = await fetch(STITCH_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as {
      error?: StitchMcpError
      result?: { content?: Array<{ text?: string }> }
    }
    const text = String(json.result?.content?.[0]?.text ?? '').trim()
    if (json.error) {
      lastError = json.error.message ?? JSON.stringify(json.error)
      continue
    }
    if (!text) continue
    try {
      const parsed = JSON.parse(text) as
        | Array<Record<string, unknown>>
        | { projects?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> }
      if (Array.isArray(parsed)) {
        rawProjects = parsed
      } else {
        rawProjects = Array.isArray(parsed.projects)
          ? parsed.projects
          : Array.isArray(parsed.items)
            ? parsed.items
            : []
      }
      if (rawProjects.length >= 0) break
    } catch {
      lastError = text
    }
  }

  if (!rawProjects.length && lastError) {
    if (/invalid argument/i.test(lastError)) return []
    throw new Error(`Stitch list_projects: ${lastError}`)
  }

  const projects = rawProjects
    .map((row) => {
      const rawName = String(row.name ?? row.projectId ?? '').trim()
      const projectId = normalizeStitchProjectId(rawName)
      const title = String(row.title ?? row.displayName ?? projectId).trim()
      const updateTime = String(row.updateTime ?? row.updatedAt ?? '').trim() || undefined
      const createTime = String(row.createTime ?? row.createdAt ?? '').trim() || undefined
      if (!projectId) return null
      return { projectId, title, updateTime, createTime }
    })
    .filter((x): x is StitchProjectSummary => Boolean(x))

  if (!opts?.includeScreenCount || projects.length === 0) return projects

  const countResults = await mapWithConcurrency(projects, 8, (project) =>
    countProjectScreensSafe(project.projectId),
  )

  return projects.map((project, index) => ({
    ...project,
    screenCount: countResults[index]?.count ?? null,
    screenCountStatus: countResults[index]?.unavailable
      ? 'unavailable'
      : countResults[index]?.error
        ? 'error'
        : 'ok',
    screenCountError: countResults[index]?.error,
  }))
}

export async function deleteStitchProject(projectId: string): Promise<void> {
  const pid = normalizeStitchProjectId(projectId)
  const name = `projects/${pid}`
  const attempts: Array<{ toolName: string; args: Record<string, unknown> }> = [
    { toolName: 'delete_project', args: { projectId: pid } },
    { toolName: 'delete_project', args: { projectId: name } },
    { toolName: 'delete_project', args: { name } },
    { toolName: 'delete_project', args: { project: name } },
    { toolName: 'remove_project', args: { projectId: pid } },
    { toolName: 'remove_project', args: { name } },
  ]
  let lastError = 'delete_project no disponible'
  for (const attempt of attempts) {
    try {
      await stitchMcpCall<Record<string, unknown>>(attempt.toolName, attempt.args)
      return
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(`No se pudo eliminar proyecto Stitch ${pid}: ${lastError}`)
}

export async function getStitchScreen(
  projectId: string,
  screenId: string,
): Promise<Record<string, unknown>> {
  const pid = normalizeStitchProjectId(projectId)
  const sid = normalizeStitchScreenId(screenId)
  const data = await stitchMcpCall<{ screen?: Record<string, unknown> }>(
    'get_screen',
    {
      name: `projects/${pid}/screens/${sid}`,
      projectId: pid,
      screenId: sid,
    },
  )
  return data.screen ?? data
}

async function downloadBinary(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download ${res.status}: ${url.slice(0, 80)}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function fetchStitchScreenAssets(
  projectId: string,
  screenId: string,
): Promise<StitchScreenAssets> {
  const screen = await getStitchScreen(projectId, screenId)
  const htmlCode = screen.htmlCode as { downloadUrl?: string } | undefined
  const screenshot = screen.screenshot as { downloadUrl?: string } | undefined
  const htmlUrl = htmlCode?.downloadUrl
  const pngUrl = screenshot?.downloadUrl
  if (!htmlUrl || !pngUrl) {
    throw new Error('Pantalla Stitch sin htmlCode o screenshot')
  }
  const sid = normalizeStitchScreenId(screenId)
  const [htmlBuf, png] = await Promise.all([
    downloadBinary(htmlUrl),
    downloadBinary(pngUrl),
  ])
  return {
    screenId: sid,
    title: String(screen.title ?? ''),
    html: htmlBuf.toString('utf8'),
    png,
    htmlDownloadUrl: htmlUrl,
    screenshotDownloadUrl: pngUrl,
  }
}

export function screenIdsFromList(screens: StitchScreenSummary[]): Set<string> {
  return new Set(
    screens.map((s) => normalizeStitchScreenId(s.name ?? '')),
  )
}

/** Espera a que aparezca una pantalla nueva tras generate_screen_from_text. */
export async function waitForNewStitchScreen(
  projectId: string,
  knownIds: Set<string>,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<StitchScreenSummary> {
  const timeoutMs = opts?.timeoutMs ?? 180_000
  const intervalMs = opts?.intervalMs ?? 5_000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const screens = await listStitchScreens(projectId)
    const novel = screens.filter(
      (s) => !knownIds.has(normalizeStitchScreenId(s.name ?? '')),
    )
    if (novel.length) {
      return novel[novel.length - 1]!
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(
    `Timeout esperando pantalla nueva en proyecto ${projectId} (${timeoutMs}ms)`,
  )
}
