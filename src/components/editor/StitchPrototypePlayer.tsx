'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useApp } from '@/components/app/shell'
import type { DesignPageMeta, PrototypeLink } from '@/lib/design/types'
import { screenPagesOnly } from '@/lib/design/prototypePages'

type StitchPrototypePlayerProps = {
  projectId: string
  pages: DesignPageMeta[]
  links: PrototypeLink[]
  iframeKey?: number
  onClose: () => void
}

export function StitchPrototypePlayer({
  projectId,
  pages,
  links,
  iframeKey = 0,
  onClose,
}: StitchPrototypePlayerProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const screens = useMemo(() => screenPagesOnly(pages), [pages])
  const [pageId, setPageId] = useState(screens[0]?.id ?? '')

  const linkMap = useMemo(() => {
    const m = new Map<string, PrototypeLink[]>()
    for (const l of links) {
      const arr = m.get(l.fromPageId) ?? []
      arr.push(l)
      m.set(l.fromPageId, arr)
    }
    return m
  }, [links])

  const navigateTo = useCallback((toPageId: string) => {
    if (screens.some((p) => p.id === toPageId)) setPageId(toPageId)
  }, [screens])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string; skId?: string }
      if (data?.type !== 'stitch-prototype-nav' || !data.skId) return
      const outgoing = links.filter((l) => l.fromPageId === pageId && l.fromSkId === data.skId)
      if (outgoing[0]) navigateTo(outgoing[0].toPageId)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [links, pageId, navigateTo])

  const active = screens.find((p) => p.id === pageId) ?? screens[0]
  const outgoing = active ? (linkMap.get(active.id) ?? []) : []

  return (
    <div className="stitch-prototype-player" role="dialog" aria-modal="true">
      <div className="stitch-prototype-player__backdrop" onClick={onClose} />
      <div className="stitch-prototype-player__panel">
        <header className="stitch-prototype-player__head">
          <span>{t('ed.design.prototypePlayerTitle')}</span>
          <button type="button" className="stitch-prototype-player__close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="stitch-prototype-player__nav">
          {screens.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`stitch-prototype-player__nav-btn${p.id === pageId ? ' is-active' : ''}`}
              onClick={() => setPageId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        {active ? (
          <iframe
            key={`${active.id}-${iframeKey}`}
            title={active.name}
            className="stitch-prototype-player__iframe"
            src={`/api/projects/${projectId}/design/preview?page=${encodeURIComponent(active.id)}&k=${iframeKey}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : null}
        {outgoing.length > 0 ? (
          <div className="stitch-prototype-player__links">
            {outgoing.map((l) => (
              <button
                key={l.id}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => navigateTo(l.toPageId)}
              >
                → {l.label ?? l.toPageId}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
