'use client'

import JSZip from 'jszip'
import { apiFetch } from '@/lib/api/client'
import { findDemoProject, isDemoProjectId } from '@/lib/auth/demo'
import { fetchDemoProjectFiles } from '@/lib/auth/demoProjectFilesClient'
import { normalizeCodeTemplate, type CodeTemplate } from '@/lib/codeTemplates'
import { normalizeCmsExportPaths } from '@/lib/design/cmsExportPaths'
import { appendPlatformImportBundles } from '@/lib/projects/platformImportZip'
import { zipProjectFileEntry } from '@/lib/projects/zipProjectFileEntry'

type ProjectFile = { path: string; content: string }

const PREVIEW_HTML_RE = /^preview\/(?:.+\/)?index\.html$/i

function slugFilename(name: string) {
  const base = name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'project'
}

async function loadProjectFiles(projectId: string): Promise<ProjectFile[]> {
  if (isDemoProjectId(projectId)) {
    return (await fetchDemoProjectFiles(projectId)).map((f) => ({
      path: f.path,
      content: f.content,
    }))
  }
  const data = await apiFetch<{ files: ProjectFile[] }>(`/api/projects/${projectId}/files`)
  return (data.files ?? []).map((f) => ({ path: f.path, content: f.content }))
}

type DownloadZipOptions = {
  projectId?: string
  codeTemplate?: CodeTemplate | string | null
}

async function loadProjectCodeTemplate(projectId?: string): Promise<CodeTemplate | null> {
  if (!projectId) return null
  if (isDemoProjectId(projectId)) {
    const proj = findDemoProject(projectId)
    return proj?.codeTemplate ? normalizeCodeTemplate(proj.codeTemplate) : null
  }
  const data = await apiFetch<{ project?: { codeTemplate?: string | null; code_template?: string | null } }>(
    `/api/projects/${projectId}`,
  ).catch(() => ({} as { project?: { codeTemplate?: string | null; code_template?: string | null } }))
  const raw = data.project?.codeTemplate ?? data.project?.code_template ?? null
  return raw ? normalizeCodeTemplate(raw) : null
}

async function loadCoverImages(projectId?: string): Promise<string[]> {
  if (!projectId) return []
  if (isDemoProjectId(projectId)) {
    const proj = findDemoProject(projectId)
    return Array.isArray(proj?.coverImages) ? proj.coverImages.filter(Boolean) : []
  }
  const data = await apiFetch<{ project?: { coverImages?: string[] | null; cover_images?: string[] | null } }>(
    `/api/projects/${projectId}`,
  ).catch(() => ({} as { project?: { coverImages?: string[] | null; cover_images?: string[] | null } }))
  const project = data.project
  const covers = project?.coverImages ?? project?.cover_images ?? []
  return Array.isArray(covers) ? covers.filter(Boolean) : []
}

function extensionFromResponse(contentType: string | null, url: string): string {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg'
  const ext = url.split('?')[0]?.split('.').pop()?.toLowerCase()
  return ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg'
}

async function appendCoverScreenshots(zip: JSZip, urls: string[]) {
  if (!urls.length) return
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (!url) continue
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const arr = await res.arrayBuffer()
      const ext = extensionFromResponse(res.headers.get('content-type'), url)
      const idx = String(i + 1).padStart(2, '0')
      zip.file(`screenshots/cover-${idx}.${ext}`, arr, { binary: true })
    } catch {
      /* ignore screenshot download failures */
    }
  }
}

export function normalizePathsForDownload(
  files: ProjectFile[],
  codeTemplate: CodeTemplate | null,
): ProjectFile[] {
  if (!files.length || !codeTemplate) return files

  const scoped = files.map((f) => ({ path: f.path.replace(/^\/+/, ''), content: f.content }))
  const preserved = scoped.filter((f) => f.path.startsWith('design/') || f.path.startsWith('spec/'))
  const toNormalize = scoped.filter((f) => !f.path.startsWith('design/') && !f.path.startsWith('spec/'))
  const normalized = normalizeCmsExportPaths(toNormalize, codeTemplate)

  const deduped = new Map<string, string>()
  for (const f of [...preserved, ...normalized]) deduped.set(f.path, f.content)
  const dedupedFiles = [...deduped.entries()].map(([path, content]) => ({ path, content }))
  return rewritePreviewLinksForLocalZip(dedupedFiles, codeTemplate)
}

function previewFilePathToRoute(path: string): string {
  const normalized = path.replace(/^\/+/, '')
  if (normalized === 'preview/index.html') return '/'
  const m = normalized.match(/^preview\/(.+)\/index\.html$/i)
  return m?.[1] ? `/${m[1].replace(/\/+/g, '/')}` : '/'
}

function relativePath(fromDir: string, toFile: string): string {
  const fromParts = fromDir.split('/').filter(Boolean)
  const toParts = toFile.split('/').filter(Boolean)
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++
  }
  const up = fromParts.slice(common).map(() => '..')
  const down = toParts.slice(common)
  const rel = [...up, ...down].join('/')
  return rel || 'index.html'
}

function rewritePreviewLinksForLocalZip(
  files: ProjectFile[],
  codeTemplate: CodeTemplate | null,
): ProjectFile[] {
  if (codeTemplate !== 'html') return files
  const previewHtml = files.filter((f) => PREVIEW_HTML_RE.test(f.path.replace(/^\/+/, '')))
  if (!previewHtml.length) return files

  const routeToPreviewPath = new Map<string, string>()
  for (const f of previewHtml) {
    const normalizedPath = f.path.replace(/^\/+/, '')
    routeToPreviewPath.set(previewFilePathToRoute(normalizedPath), normalizedPath)
  }

  return files.map((f) => {
    const filePath = f.path.replace(/^\/+/, '')
    if (!PREVIEW_HTML_RE.test(filePath)) return f
    const fromDir = filePath.split('/').slice(0, -1).join('/')
    const content = f.content.replace(/href\s*=\s*(["'])([^"']+)\1/gi, (full, quote: string, href: string) => {
      if (!href.startsWith('/') || href.startsWith('//')) return full
      const [pathOnly, suffix = ''] = href.split(/(?=[?#])/)
      const normalizedPath = (pathOnly || '/').replace(/\/+$/, '') || '/'
      const targetPath = routeToPreviewPath.get(normalizedPath)
      if (!targetPath) return full
      const rel = relativePath(fromDir, targetPath)
      return `href=${quote}${rel}${suffix}${quote}`
    })
    return { ...f, content }
  })
}

async function zipAndDownload(files: ProjectFile[], projectName: string, options?: DownloadZipOptions) {
  if (!files.length) {
    throw new Error('no_files')
  }
  const codeTemplate =
    options?.codeTemplate != null
      ? normalizeCodeTemplate(String(options.codeTemplate))
      : await loadProjectCodeTemplate(options?.projectId)
  const filesForZip = normalizePathsForDownload(files, codeTemplate)
  const zip = new JSZip()
  for (const f of filesForZip) {
    const zipPath = f.path.replace(/^\//, '')
    const { data, binary } = zipProjectFileEntry(zipPath, f.content)
    zip.file(zipPath, data, binary ? { binary: true } : undefined)
  }
  const coverUrls = await loadCoverImages(options?.projectId)
  await appendCoverScreenshots(zip, coverUrls)
  await appendPlatformImportBundles(zip, filesForZip, codeTemplate)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slugFilename(projectName)}.zip`
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Descarga un ZIP con los archivos actuales del workspace (p. ej. buffers del editor). */
export async function downloadWorkspaceZip(
  projectName: string,
  workspaceFiles: ProjectFile[],
  options?: DownloadZipOptions,
) {
  await zipAndDownload(workspaceFiles, projectName, options)
}

export async function downloadProjectZip(projectId: string, projectName: string) {
  const files = await loadProjectFiles(projectId)
  await zipAndDownload(files, projectName, { projectId })
}
