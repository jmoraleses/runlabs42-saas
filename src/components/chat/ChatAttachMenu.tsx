'use client'

import React, { useRef, useState } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { ComposerToolButton } from '@/components/chat/ComposerToolButton'
import { useCloseOnClickOutside } from '@/hooks/useCloseOnClickOutside'
import {
  addImageAttachment,
  MAX_CHAT_IMAGES,
  type LocalImageAttachment,
} from '@/lib/chat/imageAttachments'

type ChatAttachMenuProps = {
  mode?: 'images' | 'editor'
  images: LocalImageAttachment[]
  onImagesChange: (images: LocalImageAttachment[]) => void
  disabled?: boolean
  maxImages?: number
  chatSessionId?: string
  projectId?: string
  onGithubImport?: () => void
  githubImportEnabled?: boolean
  onFigmaImport?: () => void
  figmaImportEnabled?: boolean
  onCanvaImport?: () => void
  canvaImportEnabled?: boolean
  onStitchImport?: () => void
  stitchImportEnabled?: boolean
  onError?: (message: string | null) => void
}

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)

const PlugIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 22v-3" />
    <path d="M12 5V2" />
    <path d="M17 22v-3" />
    <path d="M17 5V2" />
    <rect x="5" y="5" width="14" height="10" rx="2" />
    <path d="M9 19h6" />
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
)

const FigmaIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
    <path
      fill="#f24e1e"
      d="M7 3h6a4 4 0 0 1 0 8H7V3zm0 8h7a4 4 0 0 1 0 8H7v-8zM7 3v16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3z"
    />
  </svg>
)

const CanvaIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
    <rect width="24" height="24" rx="5" fill="#00c4cc" />
    <circle cx="8.5" cy="12" r="3.15" fill="#7d2ae8" />
    <circle cx="12" cy="8.5" r="3.15" fill="#fff" />
    <circle cx="15.5" cy="13.5" r="3.15" fill="#ffc96b" />
  </svg>
)

export function ChatAttachMenu({
  mode = 'images',
  images,
  onImagesChange,
  disabled,
  maxImages = MAX_CHAT_IMAGES,
  chatSessionId,
  projectId,
  onGithubImport,
  githubImportEnabled = false,
  onFigmaImport,
  figmaImportEnabled = true,
  onCanvaImport,
  canvaImportEnabled = true,
  onStitchImport,
  stitchImportEnabled = true,
  onError,
}: ChatAttachMenuProps) {
  const { t, navigate } = useApp() as { t: (k: string) => string; navigate: (p: string) => void }
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useCloseOnClickOutside(rootRef, open, () => setOpen(false))

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    const next = [...images]
    let lastError: string | null = null

    for (const file of Array.from(files)) {
      if (next.length >= maxImages) {
        lastError = t('chat.attachMenu.maxImages').replace('{n}', String(maxImages))
        break
      }
      try {
        next.push(await addImageAttachment(file, chatSessionId, projectId))
        onError?.(null)
      } catch (e) {
        lastError = e instanceof Error ? e.message : t('chat.attachMenu.invalidImage')
      }
    }

    if (lastError) onError?.(lastError)
    if (next.length > images.length) onImagesChange(next)
    if (fileRef.current) fileRef.current.value = ''
    setOpen(false)
  }

  const imageLabel =
    mode === 'editor' ? t('chat.attachMenu.uploadImage') : t('chat.attachMenu.computer')
  const imageDisabled = images.length >= maxImages
  const showDesignImport = mode === 'editor'
  const figmaReady = Boolean(onFigmaImport) && figmaImportEnabled && !disabled
  const canvaReady = Boolean(onCanvaImport) && canvaImportEnabled && !disabled
  const stitchReady = Boolean(onStitchImport) && stitchImportEnabled && !disabled

  return (
    <div className="composer-menu-anchor" ref={rootRef}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <ComposerToolButton
        label={t('chat.attachMenu.open')}
        active={open}
        disabled={disabled && !open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.Plus />
      </ComposerToolButton>

      {open && (
        <div className="composer-menu composer-menu--attach" role="menu">
          {/* ── Adjuntar ── */}
          <p className="composer-menu-heading">{t('chat.attachMenu.attachSection')}</p>

          {/* Imagen */}
          <button
            type="button"
            role="menuitem"
            className="composer-menu-item composer-menu-item--rich"
            disabled={imageDisabled}
            aria-disabled={imageDisabled || undefined}
            onClick={() => { fileRef.current?.click() }}
          >
            <span className="composer-menu-item-icon-bg composer-menu-item-icon-bg--image">
              <ImageIcon />
            </span>
            <span className="composer-menu-item-body">
              <span className="composer-menu-item-title">{imageLabel}</span>
              <span className="composer-menu-item-desc">{t('chat.attachMenu.imageDesc')}</span>
            </span>
          </button>

          {showDesignImport ? (
            <>
              <div className="composer-menu-divider" />
              <p className="composer-menu-heading">{t('chat.attachMenu.importSection')}</p>

              <button
                type="button"
                role="menuitem"
                className={`composer-menu-item composer-menu-item--rich${!figmaReady ? ' is-disabled' : ''}`}
                disabled={!figmaReady}
                aria-disabled={!figmaReady || undefined}
                onClick={() => {
                  if (!figmaReady || !onFigmaImport) return
                  setOpen(false)
                  onFigmaImport()
                }}
              >
                <span className="composer-menu-item-icon-bg composer-menu-item-icon-bg--figma">
                  <FigmaIcon />
                </span>
                <span className="composer-menu-item-body">
                  <span className="composer-menu-item-title">{t('chat.attachMenu.figma')}</span>
                  <span className="composer-menu-item-desc">{t('ed.design.figmaAttachDesc')}</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                className={`composer-menu-item composer-menu-item--rich${!stitchReady ? ' is-disabled' : ''}`}
                disabled={!stitchReady}
                aria-disabled={!stitchReady || undefined}
                onClick={() => {
                  if (!stitchReady || !onStitchImport) return
                  setOpen(false)
                  onStitchImport()
                }}
              >
                <span className="composer-menu-item-icon-bg composer-menu-item-icon-bg--connectors">
                  <PlugIcon />
                </span>
                <span className="composer-menu-item-body">
                  <span className="composer-menu-item-title">{t('chat.attachMenu.stitch')}</span>
                  <span className="composer-menu-item-desc">{t('chat.attachMenu.stitchDesc')}</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                className={`composer-menu-item composer-menu-item--rich${!canvaReady ? ' is-disabled' : ''}`}
                disabled={!canvaReady}
                aria-disabled={!canvaReady || undefined}
                onClick={() => {
                  if (!canvaReady || !onCanvaImport) return
                  setOpen(false)
                  onCanvaImport()
                }}
              >
                <span className="composer-menu-item-icon-bg composer-menu-item-icon-bg--canva">
                  <CanvaIcon />
                </span>
                <span className="composer-menu-item-body">
                  <span className="composer-menu-item-title">{t('chat.attachMenu.canva')}</span>
                  <span className="composer-menu-item-desc">{t('chat.attachMenu.canvaDesc')}</span>
                </span>
              </button>
            </>
          ) : null}

          {/* ── Conectar ── */}
          <div className="composer-menu-divider" />
          <p className="composer-menu-heading">{t('chat.attachMenu.connectSection')}</p>

          <button
            type="button"
            role="menuitem"
            className="composer-menu-item composer-menu-item--rich"
            onClick={() => { setOpen(false); navigate('/settings?tab=connect') }}
          >
            <span className="composer-menu-item-icon-bg composer-menu-item-icon-bg--connectors">
              <PlugIcon />
            </span>
            <span className="composer-menu-item-body">
              <span className="composer-menu-item-title">{t('chat.attachMenu.connectors')}</span>
              <span className="composer-menu-item-desc">{t('chat.attachMenu.connectorsDesc')}</span>
            </span>
            <span className="composer-menu-item-arrow"><ArrowIcon /></span>
          </button>
        </div>
      )}
    </div>
  )
}
