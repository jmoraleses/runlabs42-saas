'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DemoLocalBootstrap } from '@/components/app/DemoLocalBootstrap'
import { registerDemoAutoProject } from '@/lib/auth/demo'
import {
  AUTO_TOPIC_MAX_SCREENS_LIMIT,
  clampTopicMaxScreens,
  enrichTopicPromptForStitch,
} from '@/lib/auto/topicStitchPrompt'
import {
  parseStitchDesignType,
  type StitchDesignType,
} from '@/lib/auto/stitch/stitchDesignType'
import '@/app/auto/auto.css'

const DEFAULT_AUTO_TOPIC_MODEL_ID = 'gemini-2.5-flash-lite'
const AUTO_TOPICS_STORAGE_KEY = 'auto_topics_session_cache_v1'
const STITCH_STUDIO_IMPORTS_KEY = 'auto_stitch_studio_imports_v1'

type StitchStatus = {
  configured: boolean
  connected: boolean
  ok?: boolean
  message: string
  accountEmail?: string | null
}
type StatusResponse = { stitch: StitchStatus }

type LlmModelOption = { id: string; label: string }
type TopicItem = {
  id: string
  topic: string
  prompt: string
  status: 'pending' | 'done'
  designType: StitchDesignType
}

function mapTopicItem(
  x: Record<string, unknown>,
  fallbackDesignType: StitchDesignType = 'web',
): TopicItem | null {
  const id = String(x.id ?? '').trim()
  const topic = String(x.topic ?? '').trim()
  const prompt = String(x.prompt ?? '').trim()
  if (!id || !topic || !prompt) return null
  return {
    id,
    topic,
    prompt,
    status: String(x.status ?? 'pending') === 'done' ? 'done' : 'pending',
    designType: parseStitchDesignType(x.designType ?? fallbackDesignType),
  }
}

type ZipAnalysis = {
  zipName: string
  zipPath: string
  projectTitle: string
  pages: Array<{ pageId: string; pageName: string; htmlEntryPath: string; htmlSize: number }>
  assetCount: number
  totalBytes: number
  error?: string
}
type ZipImportResult = {
  zipName: string
  ok: boolean
  projectId?: string
  projectTitle?: string
  pageCount?: number
  assetCount?: number
  error?: string
}

type StitchProjectListItem = {
  projectId: string | null
  title: string
  updateTime?: string
  createTime?: string
  screenCount?: number | null
  screenCountStatus?: 'ok' | 'error' | 'unavailable'
  screenCountError?: string
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function stitchListKey(p: Pick<StitchProjectListItem, 'projectId' | 'title'>): string {
  return p.projectId ?? p.title
}

function screenCountLabel(p: StitchProjectListItem): string {
  if (p.screenCountStatus === 'unavailable') return 'n/d'
  if (p.screenCountStatus === 'error') return 'error'
  if (typeof p.screenCount === 'number' && Number.isFinite(p.screenCount)) {
    return String(p.screenCount)
  }
  return '—'
}

export default function AutoPage() {
  // Status / Stitch
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Topics
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>([])
  const [topicModelId, setTopicModelId] = useState('')
  const [maxScreens, setMaxScreens] = useState(8)
  const [generating, setGenerating] = useState(false)
  const [topicError, setTopicError] = useState<string | null>(null)
  const [topicNotice, setTopicNotice] = useState<string | null>(null)
  const [runningTopicId, setRunningTopicId] = useState<string | null>(null)
  const [runningBulkTopics, setRunningBulkTopics] = useState(false)
  const [topicSelected, setTopicSelected] = useState<Set<string>>(new Set())
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)

  // ZIP folder import
  const [zipFolderPath, setZipFolderPath] = useState('')
  const [zipAnalyses, setZipAnalyses] = useState<ZipAnalysis[]>([])
  const [zipSelected, setZipSelected] = useState<Set<string>>(new Set())
  const [zipScanning, setZipScanning] = useState(false)
  const [zipImporting, setZipImporting] = useState(false)
  const [zipError, setZipError] = useState<string | null>(null)
  const [zipNotice, setZipNotice] = useState<string | null>(null)
  const [zipResults, setZipResults] = useState<ZipImportResult[]>([])

  // Stitch projects list
  const [projects, setProjects] = useState<StitchProjectListItem[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [projectsNotice, setProjectsNotice] = useState<string | null>(null)
  const [downloadingProjectId, setDownloadingProjectId] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [studioImports, setStudioImports] = useState<
    Record<string, { projectId: string; projectTitle: string }>
  >({})

  const stitchConnected = Boolean(status?.stitch?.connected ?? status?.stitch?.ok)

  const stitchProjectsReadyCount = useMemo(
    () => projects.filter((p) => studioImports[stitchListKey(p)]).length,
    [projects, studioImports],
  )

  const saveTopicsToLocalCache = useCallback((next: TopicItem[]) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(AUTO_TOPICS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* noop */
    }
  }, [])

  const readTopicsFromLocalCache = useCallback((): TopicItem[] => {
    try {
      if (typeof window === 'undefined') return []
      const raw = localStorage.getItem(AUTO_TOPICS_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((x) => mapTopicItem(x))
        .filter((x): x is TopicItem => x !== null)
    } catch {
      return []
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = (await fetch('/api/auto/stitch/status').then((r) => r.json())) as StatusResponse
      setStatus(data)
    } catch {
      /* noop */
    }
  }, [])

  const loadTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/auto/topic')
      if (!res.ok) {
        const cached = readTopicsFromLocalCache()
        if (cached.length) setTopics(cached)
        return
      }
      const data = (await res.json()) as {
        savedItems?: Array<Record<string, unknown>>
        modelId?: unknown
      }
      const cachedById = new Map(readTopicsFromLocalCache().map((t) => [t.id, t]))
      const saved = Array.isArray(data.savedItems)
        ? data.savedItems
            .map((x) =>
              mapTopicItem(x, cachedById.get(String(x.id ?? '').trim())?.designType ?? 'web'),
            )
            .filter((x): x is TopicItem => x !== null)
        : []
      if (saved.length) {
        setTopics(saved)
        saveTopicsToLocalCache(saved)
      } else {
        const cached = readTopicsFromLocalCache()
        setTopics(cached)
      }
      const serverModel = String(data.modelId ?? '').trim()
      if (serverModel) setTopicModelId((prev) => prev || serverModel)
    } catch {
      const cached = readTopicsFromLocalCache()
      if (cached.length) setTopics(cached)
    }
  }, [readTopicsFromLocalCache, saveTopicsToLocalCache])

  const loadModels = useCallback(async () => {
    try {
      const data = (await fetch('/api/ai/models').then((r) => r.json())) as {
        models?: Array<Record<string, unknown>>
      }
      const next = Array.isArray(data.models)
        ? data.models
            .filter((m) => m?.category === 'text' && m?.enabled === true)
            .filter((m) => {
              const id = String(m.id ?? '').trim().toLowerCase()
              const vendor = String(m.vendor ?? m.provider ?? '').trim().toLowerCase()
              return vendor === 'google' || id.startsWith('gemini') || id.startsWith('google/')
            })
            .map((m) => ({ id: String(m.id ?? '').trim(), label: String(m.id ?? '').trim() }))
            .filter((m) => m.id)
        : []
      setLlmModels(next)
      setTopicModelId((prev) => {
        if (prev) return prev
        const preferred = next.find((m) => m.id === DEFAULT_AUTO_TOPIC_MODEL_ID)?.id
        return preferred || next[0]?.id || DEFAULT_AUTO_TOPIC_MODEL_ID
      })
    } catch {
      /* noop */
    }
  }, [])

  const loadProjects = useCallback(async () => {
    if (!stitchConnected) {
      setProjects([])
      return
    }
    setLoadingProjects(true)
    setProjectsError(null)
    try {
      const res = await fetch('/api/auto/stitch/projects?limit=500')
      const data = (await res.json().catch(() => ({}))) as {
        projects?: Array<Record<string, unknown>>
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const next: StitchProjectListItem[] = Array.isArray(data.projects)
        ? data.projects
            .map((p) => {
              const id = String(p.projectId ?? '').trim()
              return {
              projectId: id || null,
              title: String(p.title ?? '').trim(),
              updateTime: String(p.updateTime ?? '').trim() || undefined,
              createTime: String(p.createTime ?? '').trim() || undefined,
              screenCount:
                typeof p.screenCount === 'number' && Number.isFinite(p.screenCount as number)
                  ? (p.screenCount as number)
                  : null,
              screenCountStatus:
                p.screenCountStatus === 'error'
                  ? 'error'
                  : p.screenCountStatus === 'ok'
                    ? 'ok'
                    : p.screenCountStatus === 'unavailable'
                      ? 'unavailable'
                      : undefined,
              screenCountError: String(p.screenCountError ?? '').trim() || undefined,
            }})
            .filter((p) => p.title)
        : []
      setProjects(next)
    } catch (e) {
      setProjectsError(e instanceof Error ? e.message : 'No se pudieron cargar los proyectos')
    } finally {
      setLoadingProjects(false)
    }
  }, [stitchConnected])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STITCH_STUDIO_IMPORTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { projectId?: string; projectTitle?: string }>
        const next: Record<string, { projectId: string; projectTitle: string }> = {}
        for (const [k, v] of Object.entries(parsed)) {
          const projectId = String(v?.projectId ?? '').trim()
          if (!projectId) continue
          next[k] = {
            projectId,
            projectTitle: String(v?.projectTitle ?? k).trim() || k,
          }
        }
        setStudioImports(next)
      }
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    void loadModels()
    void loadTopics()
  }, [refreshStatus, loadModels, loadTopics])

  useEffect(() => {
    if (stitchConnected) void loadProjects()
  }, [stitchConnected, loadProjects])

  // --- Connect ---
  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/auto/stitch/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as {
        ok: boolean
        message: string
        accountEmail?: string | null
      }
      setStatus({
        stitch: {
          configured: true,
          connected: data.ok,
          message: data.message,
          accountEmail: data.accountEmail ?? null,
        },
      })
    } catch (e) {
      setProjectsError(e instanceof Error ? e.message : 'Error conectando con Stitch')
    } finally {
      setConnecting(false)
    }
  }, [])

  // --- Topics ---
  const generateTopics = useCallback(async () => {
    setGenerating(true)
    setTopicError(null)
    setTopicNotice(null)
    try {
      const res = await fetch('/api/auto/topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: topicModelId || undefined,
          maxScreens,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        items?: Array<Record<string, unknown>>
        savedItems?: Array<Record<string, unknown>>
        modelId?: unknown
        persisted?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const sourceItems = Array.isArray(data.savedItems) ? data.savedItems : data.items
      const saved = Array.isArray(sourceItems)
        ? sourceItems
            .map((x) => mapTopicItem(x))
            .filter((x): x is TopicItem => x !== null)
        : []
      setTopics(saved)
      saveTopicsToLocalCache(saved)
      const serverModel = String(data.modelId ?? '').trim()
      if (serverModel) setTopicModelId(serverModel)
      if (!saved.length) {
        setTopicNotice('No se añadieron topics nuevos (pueden estar ya existentes).')
      } else if (data.persisted === false) {
        setTopicNotice('Lista generada en sesión actual (sin persistencia en BD).')
      } else {
        setTopicNotice('Lista de topics actualizada.')
      }
    } catch (e) {
      setTopicError(e instanceof Error ? e.message : 'No se pudo generar la lista')
    } finally {
      setGenerating(false)
    }
  }, [maxScreens, saveTopicsToLocalCache, topicModelId])

  const updateTopicDesignType = useCallback(
    (id: string, designType: StitchDesignType) => {
      setTopics((prev) => {
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                designType,
                prompt: enrichTopicPromptForStitch({
                  prompt: t.prompt,
                  maxScreens,
                  designType,
                }),
              }
            : t,
        )
        saveTopicsToLocalCache(next)
        return next
      })
    },
    [maxScreens, saveTopicsToLocalCache],
  )

  const deleteTopicFromApi = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch('/api/auto/topic', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        persisted?: boolean
      }
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      return data
    },
    [],
  )

  const deleteTopic = useCallback(
    async (id: string) => {
      setDeletingTopicId(id)
      setTopicError(null)
      try {
        await deleteTopicFromApi({ itemIds: [id] })
        setTopics((prev) => {
          const next = prev.filter((t) => t.id !== id)
          saveTopicsToLocalCache(next)
          return next
        })
        setTopicSelected((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (e) {
        setTopicError(e instanceof Error ? e.message : 'No se pudo eliminar el topic')
      } finally {
        setDeletingTopicId(null)
      }
    },
    [deleteTopicFromApi, saveTopicsToLocalCache],
  )

  const clearAllTopics = useCallback(async () => {
    if (!topics.some((t) => t.status === 'pending')) return
    if (!window.confirm('¿Eliminar todos los topics pendientes?')) return
    setTopicError(null)
    setTopicNotice(null)
    const pendingIds = new Set(topics.filter((t) => t.status === 'pending').map((t) => t.id))
    try {
      const data = await deleteTopicFromApi({ clearAll: true })
      setTopics((prev) => {
        const next = prev.filter((t) => t.status === 'done')
        saveTopicsToLocalCache(next)
        return next
      })
      setTopicSelected((prev) => {
        const next = new Set(prev)
        for (const id of pendingIds) next.delete(id)
        return next
      })
      setTopicNotice(
        data.persisted === false
          ? 'Topics pendientes eliminados de esta sesión.'
          : 'Topics pendientes eliminados.',
      )
    } catch (e) {
      setTopicError(e instanceof Error ? e.message : 'No se pudieron eliminar los topics')
    }
  }, [deleteTopicFromApi, saveTopicsToLocalCache, topics])

  const clearDoneTopics = useCallback(async () => {
    if (!topics.some((t) => t.status === 'done')) return
    if (!window.confirm('¿Eliminar todos los topics ya procesados?')) return
    setTopicError(null)
    setTopicNotice(null)
    try {
      const data = await deleteTopicFromApi({ clearDone: true })
      setTopics((prev) => {
        const next = prev.filter((t) => t.status === 'pending')
        saveTopicsToLocalCache(next)
        return next
      })
      setTopicNotice(
        data.persisted === false
          ? 'Topics procesados eliminados de esta sesión.'
          : 'Topics procesados eliminados.',
      )
    } catch (e) {
      setTopicError(
        e instanceof Error ? e.message : 'No se pudieron eliminar los topics procesados',
      )
    }
  }, [deleteTopicFromApi, saveTopicsToLocalCache, topics])

  const processTopicInStitch = useCallback(
    async (topic: TopicItem) => {
      const res = await fetch('/api/auto/topic/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: topic.id,
          topic: topic.topic,
          prompt: topic.prompt,
          maxScreens,
          designType: topic.designType,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        stitchProjectId?: string
        projectTitle?: string
        error?: string
        ok?: boolean
      }
      if (!res.ok || !data.stitchProjectId) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      return data
    },
    [maxScreens],
  )

  const markTopicDone = useCallback(
    (id: string) => {
      setTopics((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, status: 'done' as const } : t))
        saveTopicsToLocalCache(next)
        return next
      })
      setTopicSelected((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [saveTopicsToLocalCache],
  )

  const runTopic = useCallback(
    async (topic: TopicItem) => {
      if (!stitchConnected) {
        setTopicError('Conecta Stitch antes de procesar topics.')
        return
      }
      setRunningTopicId(topic.id)
      setTopicError(null)
      setTopicNotice(null)
      try {
        const data = await processTopicInStitch(topic)
        markTopicDone(topic.id)
        setTopicNotice(
          `Proyecto “${data.projectTitle ?? topic.topic}” creado en Stitch. Recarga la lista y usa Descargar / Abrir en Studio.`,
        )
        await loadProjects()
      } catch (e) {
        setTopicError(e instanceof Error ? e.message : 'Error procesando el topic')
      } finally {
        setRunningTopicId(null)
      }
    },
    [loadProjects, markTopicDone, processTopicInStitch, stitchConnected],
  )

  const toggleTopicSel = useCallback((id: string) => {
    setTopicSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllPendingTopics = useCallback(() => {
    const pendingIds = topics.filter((t) => t.status === 'pending').map((t) => t.id)
    setTopicSelected((prev) => {
      const allSelected =
        pendingIds.length > 0 && pendingIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(pendingIds)
    })
  }, [topics])

  const runSelectedTopics = useCallback(async () => {
    const selected = topics.filter((t) => topicSelected.has(t.id) && t.status === 'pending')
    if (!selected.length) {
      setTopicError('Selecciona al menos un topic pendiente.')
      return
    }
    if (!stitchConnected) {
      setTopicError('Conecta Stitch antes de procesar topics.')
      return
    }
    if (
      !window.confirm(
        `¿Crear ${selected.length} proyecto(s) en Stitch? Puede tardar varios minutos.`,
      )
    ) {
      return
    }
    setRunningBulkTopics(true)
    setTopicError(null)
    setTopicNotice(null)
    let ok = 0
    let failed = 0
    for (const topic of selected) {
      setRunningTopicId(topic.id)
      try {
        const data = await processTopicInStitch(topic)
        markTopicDone(topic.id)
        ok += 1
        setTopicNotice(
          ok === 1 && selected.length === 1
            ? `Proyecto “${data.projectTitle ?? topic.topic}” creado en Stitch.`
            : `Creación masiva: ${ok}/${selected.length} completado(s)…`,
        )
      } catch (e) {
        failed += 1
        setTopicError(
          e instanceof Error
            ? `${topic.topic}: ${e.message}`
            : `Error procesando “${topic.topic}”`,
        )
      } finally {
        setRunningTopicId(null)
      }
    }
    setRunningBulkTopics(false)
    if (ok > 0) await loadProjects()
    if (ok > 0) {
      setTopicNotice(
        `Creación masiva: ${ok} proyecto(s) en Stitch${failed ? `, ${failed} con error` : ''}. Recarga la lista de proyectos abajo.`,
      )
    }
  }, [
    loadProjects,
    markTopicDone,
    processTopicInStitch,
    stitchConnected,
    topicSelected,
    topics,
  ])

  // --- ZIP folder import ---
  const scanZipFolder = useCallback(async () => {
    const folder = zipFolderPath.trim()
    if (!folder) {
      setZipError('Indica la ruta absoluta de la carpeta con los ZIPs.')
      return
    }
    setZipScanning(true)
    setZipError(null)
    setZipNotice(null)
    setZipResults([])
    try {
      const res = await fetch(
        `/api/auto/stitch/zip-import?folderPath=${encodeURIComponent(folder)}`,
      )
      const data = (await res.json().catch(() => ({}))) as {
        zips?: ZipAnalysis[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const next = (data.zips ?? []) as ZipAnalysis[]
      setZipAnalyses(next)
      setZipSelected(new Set(next.filter((z) => !z.error && z.pages.length).map((z) => z.zipName)))
      setZipNotice(
        next.length === 0
          ? 'No se encontraron archivos .zip en la carpeta.'
          : `Encontrados ${next.length} ZIP(s).`,
      )
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'No se pudo analizar la carpeta')
      setZipAnalyses([])
      setZipSelected(new Set())
    } finally {
      setZipScanning(false)
    }
  }, [zipFolderPath])

  const importSelectedZips = useCallback(async () => {
    if (!zipSelected.size) {
      setZipError('Selecciona al menos un ZIP para importar.')
      return
    }
    setZipImporting(true)
    setZipError(null)
    setZipNotice(null)
    try {
      const res = await fetch('/api/auto/stitch/zip-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: zipFolderPath.trim(),
          zipNames: [...zipSelected],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        results?: ZipImportResult[]
        okCount?: number
        failedCount?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const results = data.results ?? []
      setZipResults(results)
      const ok = data.okCount ?? 0
      const failed = data.failedCount ?? 0
      setZipNotice(`Importados ${ok} proyecto(s)${failed ? `, ${failed} con error` : ''}.`)
      const firstOk = results.find((r) => r.ok && r.projectId)
      if (firstOk?.projectId && !failed) {
        registerDemoAutoProject(
          firstOk.projectId,
          firstOk.projectTitle ?? 'Stitch ZIP',
          'html',
        )
        window.location.href = `/studio?project=${encodeURIComponent(firstOk.projectId)}`
      }
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'Error en la importación')
    } finally {
      setZipImporting(false)
    }
  }, [zipFolderPath, zipSelected])

  const toggleZipSel = useCallback((name: string) => {
    setZipSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const persistStudioImport = useCallback(
    (stitchProjectId: string, projectId: string, projectTitle: string) => {
      setStudioImports((prev) => {
        const next = {
          ...prev,
          [stitchProjectId]: { projectId, projectTitle },
        }
        try {
          localStorage.setItem(STITCH_STUDIO_IMPORTS_KEY, JSON.stringify(next))
        } catch {
          /* noop */
        }
        return next
      })
    },
    [],
  )

  const downloadAndPrepareStitchProject = useCallback(
    async (project: StitchProjectListItem): Promise<string> => {
      const listKey = stitchListKey(project)
      setDownloadingProjectId(listKey)
      setProjectsError(null)
      setProjectsNotice(null)
      try {
        const res = await fetch('/api/auto/stitch/projects/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(project.projectId ? { stitchProjectId: project.projectId } : {}),
            projectTitle: project.title,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          projectId?: string
          error?: string
          demo?: unknown
          projectTitle?: unknown
          importedPages?: number
          stitchProjectId?: string
        }
        if (!res.ok || !data.projectId) throw new Error(data.error ?? `HTTP ${res.status}`)
        const title = String(data.projectTitle ?? project.title).trim() || 'Stitch Import'
        if (data.demo === true) {
          registerDemoAutoProject(data.projectId, title, 'html')
        }
        const resolvedStitchId =
          String(data.stitchProjectId ?? project.projectId ?? '').trim() || listKey
        for (const key of new Set([listKey, resolvedStitchId, project.projectId].filter(Boolean))) {
          persistStudioImport(key, data.projectId, title)
        }
        const pages =
          typeof data.importedPages === 'number' ? ` (${data.importedPages} pantalla(s))` : ''
        setProjectsNotice(
          `“${title}” descargado desde Stitch y preparado para Studio${pages}. Pulsa Abrir en Studio.`,
        )
        return data.projectId
      } catch (e) {
        setProjectsError(
          e instanceof Error ? e.message : 'No se pudo descargar ni preparar el proyecto',
        )
        return ''
      } finally {
        setDownloadingProjectId(null)
      }
    },
    [persistStudioImport],
  )

  const downloadAllStitchProjects = useCallback(async () => {
    const pending = projects.filter((p) => !studioImports[stitchListKey(p)])
    if (!pending.length) {
      setProjectsNotice('Todos los proyectos listados ya están preparados para Studio.')
      return
    }
    if (
      !window.confirm(
        `¿Descargar y preparar ${pending.length} proyecto(s) en Stitch? Puede tardar varios minutos.`,
      )
    ) {
      return
    }
    setDownloadingAll(true)
    setProjectsError(null)
    let ok = 0
    let failed = 0
    for (const project of pending) {
      try {
        await downloadAndPrepareStitchProject(project)
        ok += 1
      } catch {
        failed += 1
      }
    }
    setProjectsNotice(
      `Descarga masiva: ${ok} listo(s) para Studio${failed ? `, ${failed} con error` : ''}.`,
    )
    setDownloadingAll(false)
  }, [downloadAndPrepareStitchProject, projects, studioImports])

  const pendingTopics = useMemo(() => topics.filter((t) => t.status === 'pending'), [topics])
  const doneTopics = useMemo(() => topics.filter((t) => t.status === 'done'), [topics])
  const selectedPendingCount = useMemo(
    () => pendingTopics.filter((t) => topicSelected.has(t.id)).length,
    [pendingTopics, topicSelected],
  )
  const allPendingSelected =
    pendingTopics.length > 0 && pendingTopics.every((t) => topicSelected.has(t.id))
  const topicsBusy = runningBulkTopics || runningTopicId !== null
  const accountEmail = status?.stitch?.accountEmail
  const statusMessage = status?.stitch?.message ?? 'Comprobando credenciales…'

  return (
    <>
      <DemoLocalBootstrap />
      <div className="auto-page">
        <header className="auto-header">
          <div className="auto-header__title">
            <p className="auto-eyebrow">Auto · Agent Platform + Stitch</p>
            <h1>Generación automática de webs</h1>
            <p className="auto-sub">
              Agent Platform genera topics; Stitch se automatiza por navegador (Playwright, sin API). Crea
              proyectos arriba e impórtalos abajo a{' '}
              <Link href="/studio" className="auto-inline-link">Studio</Link>.
            </p>
          </div>
          <div className={`auto-status${stitchConnected ? ' is-ok' : ''}`}>
            <div className="auto-status__row">
              <span className={`auto-dot${stitchConnected ? ' is-ok' : ' is-warn'}`} />
              <strong>{stitchConnected ? 'Stitch listo (Playwright)' : 'Stitch sin sesión'}</strong>
              {accountEmail ? <span className="auto-status__email">{accountEmail}</span> : null}
            </div>
            <p className="auto-status__msg">{statusMessage}</p>
            <button
              type="button"
              className="auto-btn auto-btn--ghost"
              disabled={connecting}
              onClick={handleConnect}
            >
              {connecting ? 'Validando…' : stitchConnected ? 'Revalidar sesión' : 'Validar sesión Stitch'}
            </button>
          </div>
        </header>

        {/* Topics section */}
        <section className="auto-panel">
          <div className="auto-panel__head">
            <div>
              <h2>Topics</h2>
              <p className="auto-muted">
                Agent Platform en Google Cloud (Gemini) genera 10 topics con prompts listos para Stitch.
                Se guardan en BD para gestión y reutilización.
              </p>
            </div>
            <div className="auto-panel__actions">
              <label className="auto-toolbar__field">
                <span>Modelo</span>
                <select
                  value={topicModelId}
                  onChange={(e) => setTopicModelId(e.target.value)}
                  disabled={generating || !llmModels.length}
                >
                  {!llmModels.length && <option value={topicModelId}>{topicModelId || '—'}</option>}
                  {llmModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="auto-toolbar__field">
                <span>Pantallas/proy.</span>
                <input
                  type="number"
                  min={1}
                  max={AUTO_TOPIC_MAX_SCREENS_LIMIT}
                  value={maxScreens}
                  onChange={(e) => {
                    const next = clampTopicMaxScreens(e.target.value)
                    setMaxScreens(next)
                    setTopics((prev) => {
                      const updated = prev.map((t) =>
                        t.status === 'pending'
                          ? {
                              ...t,
                              prompt: enrichTopicPromptForStitch({
                                prompt: t.prompt,
                                maxScreens: next,
                                designType: t.designType,
                              }),
                            }
                          : t,
                      )
                      saveTopicsToLocalCache(updated)
                      return updated
                    })
                  }}
                />
              </label>
              <button
                type="button"
                className="auto-btn"
                disabled={generating}
                onClick={() => void generateTopics()}
              >
                {generating ? 'Generando…' : 'Generar 10 topics'}
              </button>
              <button
                type="button"
                className="auto-btn"
                disabled={
                  !selectedPendingCount ||
                  topicsBusy ||
                  !stitchConnected
                }
                onClick={() => void runSelectedTopics()}
                title={
                  !stitchConnected
                    ? 'Valida sesión Stitch'
                    : !selectedPendingCount
                      ? 'Marca topics pendientes con la casilla'
                      : undefined
                }
              >
                {runningBulkTopics
                  ? `Creando (${selectedPendingCount})…`
                  : `Crear seleccionados (${selectedPendingCount})`}
              </button>
              {pendingTopics.length > 0 ? (
                <label className="auto-toolbar__check">
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    disabled={topicsBusy}
                    onChange={toggleAllPendingTopics}
                  />
                  <span>Seleccionar pendientes</span>
                </label>
              ) : null}
              <button
                type="button"
                className="auto-btn auto-btn--ghost"
                disabled={!pendingTopics.length}
                onClick={() => void clearAllTopics()}
              >
                Limpiar pendientes
              </button>
              <button
                type="button"
                className="auto-btn auto-btn--ghost"
                disabled={!doneTopics.length}
                onClick={() => void clearDoneTopics()}
              >
                Limpiar procesados
              </button>
            </div>
          </div>

          {topicError && <div className="auto-banner auto-banner--error">{topicError}</div>}
          {topicNotice && <div className="auto-banner auto-banner--ok">{topicNotice}</div>}

          {!topics.length ? (
            <div className="auto-empty auto-empty--small">
              <p>
                No hay topics guardados. Pulsa <strong>Generar 10 topics</strong> para que Agent Platform
                cree la lista con las credenciales de tu base de datos.
              </p>
            </div>
          ) : (
            <ul className="auto-topics">
              {topics.map((t) => {
                const busy =
                  runningTopicId === t.id || deletingTopicId === t.id || runningBulkTopics
                const isDone = t.status === 'done'
                const isSelected = topicSelected.has(t.id)
                return (
                  <li
                    key={t.id}
                    className={`auto-topic${isDone ? ' is-done' : ''}${isSelected ? ' is-selected' : ''}`}
                  >
                    {!isDone ? (
                      <label className="auto-topic__select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={busy || topicsBusy}
                          onChange={() => toggleTopicSel(t.id)}
                          aria-label={`Seleccionar “${t.topic}”`}
                        />
                      </label>
                    ) : (
                      <span className="auto-topic__select" aria-hidden />
                    )}
                    <div className="auto-topic__body">
                      <div className="auto-topic__head">
                        <h3>{t.topic}</h3>
                        <span className={`auto-chip${isDone ? ' is-done' : ' is-pending'}`}>
                          {isDone ? 'Procesado' : 'Pendiente'}
                        </span>
                      </div>
                      <p className="auto-topic__prompt">{t.prompt}</p>
                    </div>
                    <div className="auto-topic__actions">
                      <label className="auto-topic__type">
                        <span>Tipo en Stitch</span>
                        <select
                          value={t.designType}
                          disabled={busy || isDone}
                          onChange={(e) =>
                            updateTopicDesignType(
                              t.id,
                              parseStitchDesignType(e.target.value),
                            )
                          }
                        >
                          <option value="web">Web</option>
                          <option value="app">App móvil</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="auto-btn"
                        disabled={busy || isDone || !stitchConnected || topicsBusy}
                        onClick={() => void runTopic(t)}
                        title={
                          !stitchConnected
                            ? 'Valida sesión Stitch (pnpm stitch:auth)'
                            : isDone
                              ? 'Topic ya procesado'
                            : `Crea en Stitch (${t.designType === 'web' ? 'Web' : 'App'}, ${maxScreens} pantalla(s))`
                        }
                      >
                        {runningTopicId === t.id
                          ? 'Generando en Stitch…'
                          : isDone
                            ? 'Ya procesado'
                            : 'Crear'}
                      </button>
                      <button
                        type="button"
                        className="auto-btn auto-btn--ghost"
                        disabled={busy || isDone || topicsBusy}
                        onClick={() => void deleteTopic(t.id)}
                      >
                        {deletingTopicId === t.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {doneTopics.length > 0 && (
            <p className="auto-muted auto-panel__footer">
              {doneTopics.length} topic(s) ya procesados — los nuevos sustituyen sólo a los pendientes.
            </p>
          )}
        </section>

        {/* ZIP folder import */}
        <section className="auto-panel">
          <div className="auto-panel__head">
            <div>
              <h2>Importar desde carpeta de ZIPs</h2>
              <p className="auto-muted">
                Descarga manualmente desde Stitch los proyectos que quieras, ponlos en una carpeta del
                servidor e indica aquí su ruta absoluta. El sistema los descomprime, los analiza y crea un
                proyecto en Studio por cada ZIP.
              </p>
            </div>
          </div>

          <div className="auto-zip-controls">
            <input
              type="text"
              className="auto-zip-input"
              value={zipFolderPath}
              onChange={(e) => setZipFolderPath(e.target.value)}
              placeholder="/Users/.../Downloads/stitch-zips"
              spellCheck={false}
            />
            <button
              type="button"
              className="auto-btn auto-btn--ghost"
              disabled={zipScanning || !zipFolderPath.trim()}
              onClick={() => void scanZipFolder()}
            >
              {zipScanning ? 'Analizando…' : 'Analizar carpeta'}
            </button>
            <button
              type="button"
              className="auto-btn"
              disabled={zipImporting || !zipSelected.size}
              onClick={() => void importSelectedZips()}
            >
              {zipImporting ? 'Importando…' : `Importar seleccionados (${zipSelected.size})`}
            </button>
          </div>

          {zipError && <div className="auto-banner auto-banner--error">{zipError}</div>}
          {zipNotice && <div className="auto-banner auto-banner--ok">{zipNotice}</div>}

          {zipAnalyses.length > 0 && (
            <ul className="auto-zip-list">
              {zipAnalyses.map((z) => {
                const importable = !z.error && z.pages.length > 0
                const result = zipResults.find((r) => r.zipName === z.zipName)
                return (
                  <li
                    key={z.zipName}
                    className={`auto-zip-item${z.error ? ' is-error' : ''}${
                      result?.ok ? ' is-done' : ''
                    }`}
                  >
                    <label className="auto-zip-item__select">
                      <input
                        type="checkbox"
                        checked={zipSelected.has(z.zipName)}
                        disabled={!importable || zipImporting}
                        onChange={() => toggleZipSel(z.zipName)}
                      />
                    </label>
                    <div className="auto-zip-item__body">
                      <div className="auto-zip-item__head">
                        <strong>{z.projectTitle}</strong>
                        <code className="auto-zip-item__name">{z.zipName}</code>
                      </div>
                      {z.error ? (
                        <p className="auto-zip-item__warn">{z.error}</p>
                      ) : (
                        <p className="auto-muted auto-zip-item__meta">
                          {z.pages.length} página(s) · {z.assetCount} asset(s) ·{' '}
                          {(z.totalBytes / 1024).toFixed(0)} KB
                        </p>
                      )}
                      {z.pages.length > 0 && (
                        <p className="auto-muted auto-zip-item__pages">
                          {z.pages.map((p) => p.pageName).join(' · ')}
                        </p>
                      )}
                      {result && !result.ok && (
                        <p className="auto-zip-item__warn">Error al importar: {result.error}</p>
                      )}
                      {result?.ok && result.projectId && (
                        <p className="auto-muted">
                          Importado →{' '}
                          <Link
                            href={`/studio?project=${encodeURIComponent(result.projectId)}`}
                            className="auto-inline-link"
                          >
                            Abrir “{result.projectTitle}” en Studio
                          </Link>
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Existing Stitch projects */}
        <section className="auto-panel">
          <div className="auto-panel__head">
            <div>
              <h2>Proyectos existentes en Stitch</h2>
              <p className="auto-muted">
                Solo proyectos propios (excluye «Compartido»). La lista se lee del panel lateral;
                al pulsar Descargar se abre el proyecto en Stitch, se exporta el ZIP y se prepara
                para Studio.
              </p>
            </div>
            <div className="auto-panel__actions">
              <button
                type="button"
                className="auto-btn auto-btn--ghost"
                disabled={!stitchConnected || loadingProjects || downloadingAll}
                onClick={() => void loadProjects()}
              >
                {loadingProjects ? 'Cargando desde Stitch…' : 'Recargar'}
              </button>
              <button
                type="button"
                className="auto-btn auto-btn--ghost"
                disabled={
                  !stitchConnected ||
                  loadingProjects ||
                  downloadingAll ||
                  !projects.some((p) => !studioImports[p.projectId])
                }
                onClick={() => void downloadAllStitchProjects()}
              >
                {downloadingAll ? 'Descargando todos…' : 'Descargar todos'}
              </button>
            </div>
          </div>

          {projectsError && <div className="auto-banner auto-banner--error">{projectsError}</div>}
          {projectsNotice && <div className="auto-banner auto-banner--ok">{projectsNotice}</div>}

          {!stitchConnected ? (
            <div className="auto-empty auto-empty--small">
              <p>Valida la sesión Stitch (pnpm stitch:auth) para listar proyectos.</p>
            </div>
          ) : !projects.length ? (
            <div className="auto-empty auto-empty--small">
              <p>
                {loadingProjects
                  ? 'Leyendo la lista completa de Stitch (puede tardar 1–2 min)…'
                  : 'No se encontraron proyectos. Pulsa Recargar.'}
              </p>
            </div>
          ) : (
            <>
              <p className="auto-projects-summary">
                <strong>{projects.length}</strong>{' '}
                {projects.length === 1 ? 'proyecto propio' : 'proyectos propios'}
                {stitchProjectsReadyCount > 0 ? (
                  <>
                    {' '}
                    · <span className="auto-projects-summary__ready">
                      {stitchProjectsReadyCount} listo
                      {stitchProjectsReadyCount === 1 ? '' : 's'} para Studio
                    </span>
                  </>
                ) : null}
              </p>
              <ul className="auto-projects">
                {projects.map((p) => {
                  const listKey = stitchListKey(p)
                  const ready = Boolean(studioImports[listKey])
                  const busy = downloadingProjectId === listKey || downloadingAll
                  const studioProjectId = studioImports[listKey]?.projectId
                  return (
                    <li
                      key={listKey}
                      className={`auto-project${ready ? ' is-studio-ready' : ''}`}
                    >
                      <div className="auto-project__mark" aria-hidden>
                        {ready ? '✓' : '◇'}
                      </div>
                      <div className="auto-project__body">
                        <div className="auto-project__head">
                          <h3 title={p.title}>{p.title}</h3>
                          {ready ? (
                            <span className="auto-chip is-done">Listo</span>
                          ) : (
                            <span className="auto-chip is-pending">Pendiente</span>
                          )}
                        </div>
                        {p.projectId ? (
                          <p className="auto-project__id" title={p.projectId}>
                            ID {p.projectId}
                          </p>
                        ) : (
                          <p className="auto-project__id auto-project__id--muted">
                            ID al descargar
                          </p>
                        )}
                      </div>
                      <div className="auto-project__actions">
                        <button
                          type="button"
                          className="auto-btn auto-btn--ghost auto-btn--sm"
                          disabled={busy}
                          onClick={() => void downloadAndPrepareStitchProject(p)}
                        >
                          {downloadingProjectId === listKey
                            ? 'Descargando…'
                            : ready
                              ? 'Re-descargar'
                              : 'Descargar'}
                        </button>
                        {ready && studioProjectId ? (
                          <Link
                            href={`/studio?project=${encodeURIComponent(studioProjectId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="auto-btn auto-btn--sm"
                          >
                            Studio
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="auto-btn auto-btn--sm"
                            disabled={busy || !ready}
                          >
                            Studio
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  )
}
