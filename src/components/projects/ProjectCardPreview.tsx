'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { isDemoProjectId } from '@/lib/auth/demo'
import { fetchDemoProjectFiles } from '@/lib/auth/demoProjectFilesClient'
import { findPreviewEntry } from '@/lib/mobile/previewServe'

type ProjectCardPreviewProps = {
  projectId: string
  name: string
  deployedUrl?: string | null
  placeholderLabel?: string
}

export function ProjectCardPreview({
  projectId,
  name,
  deployedUrl: _deployedUrl,
  placeholderLabel,
}: ProjectCardPreviewProps) {
  const [demoBlobUrl, setDemoBlobUrl] = useState<string | null>(null)
  const [iframeFailed, setIframeFailed] = useState(false)

  const remoteSrc = useMemo(() => {
    // No incrustar deployedUrl: Vercel y la mayoría de hosts bloquean iframes (X-Frame-Options).
    if (!isDemoProjectId(projectId)) return `/api/projects/${projectId}/preview`
    return null
  }, [projectId])

  useEffect(() => {
    setIframeFailed(false)
    if (remoteSrc) return
    if (!isDemoProjectId(projectId)) return

    let cancelled = false
    let objectUrl: string | null = null

    void (async () => {
      try {
        const files = await fetchDemoProjectFiles(projectId)
        if (cancelled) return
        const entry = findPreviewEntry(
          files.map((f) => ({
            id: f.path,
            projectId,
            path: f.path,
            content: f.content,
            language: f.language ?? null,
            updatedAt: '',
            storageKey: null,
            sizeBytes: f.content.length,
          })),
        )
        if (!entry) return
        const file = files.find((f) => f.path === entry)
        if (!file?.content) return
        objectUrl = URL.createObjectURL(
          new Blob([file.content], { type: 'text/html;charset=utf-8' }),
        )
        setDemoBlobUrl(objectUrl)
      } catch {
        if (!cancelled) setDemoBlobUrl(null)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setDemoBlobUrl(null)
    }
  }, [projectId, remoteSrc])

  const iframeSrc = remoteSrc ?? demoBlobUrl
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  if (!iframeSrc || iframeFailed) {
    return (
      <div className="projects-card-preview projects-card-preview--placeholder" aria-hidden>
        <span className="projects-card-preview__glyph">{initial}</span>
        {placeholderLabel ? (
          <span className="projects-card-preview__hint">{placeholderLabel}</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="projects-card-preview">
      <iframe
        src={iframeSrc}
        title={name}
        className="projects-card-preview__iframe"
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        tabIndex={-1}
        onError={() => setIframeFailed(true)}
      />
    </div>
  )
}
