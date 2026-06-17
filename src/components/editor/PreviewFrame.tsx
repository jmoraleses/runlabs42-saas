'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { VisualEditMode } from '@/lib/visual-edit/protocol'

type PreviewFrameProps = {
  iframeRef: React.Ref<HTMLIFrameElement>
  mode: VisualEditMode
  viewport?: 'sm' | 'md' | 'lg'
  src?: string
  onIframeLoad?: () => void
  /** Ocupa todo el canvas (modo Lovable en desktop). */
  fillCanvas?: boolean
}

const VIEWPORT_WIDTH: Record<string, number | '100%'> = {
  sm: 390,
  md: 768,
  lg: '100%',
}

export function PreviewFrame({
  iframeRef,
  mode: _mode,
  viewport = 'lg',
  src = '/visual-edit/preview.html',
  onIframeLoad,
  fillCanvas = false,
}: PreviewFrameProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const width = fillCanvas ? '100%' : (VIEWPORT_WIDTH[viewport] ?? '100%')
  const isFullBleed = fillCanvas || viewport === 'lg'

  return (
    <div
      className={`editor-preview-stage${isFullBleed ? ' editor-preview-stage--bleed' : ''}`}
    >
      <div
        className="editor-preview-device"
        style={{
          width: typeof width === 'number' ? width : '100%',
          maxWidth: '100%',
        }}
      >
        <iframe
          ref={iframeRef}
          title={t('ed.previewView')}
          src={src}
          className="editor-preview-iframe"
          onLoad={onIframeLoad}
        />
      </div>
    </div>
  )
}
