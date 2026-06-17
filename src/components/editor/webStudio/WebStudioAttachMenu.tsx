'use client'

import React, { useRef } from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import {
  addImageAttachment,
  MAX_CHAT_IMAGES,
  type LocalImageAttachment,
} from '@/lib/chat/imageAttachments'

type WebStudioAttachMenuProps = {
  disabled?: boolean
  projectId?: string
  images: LocalImageAttachment[]
  onImagesChange: (images: LocalImageAttachment[]) => void
  onCanvasImageImport?: () => void
  onFigmaImport?: () => void
  figmaImportEnabled?: boolean
  onCanvaImport?: () => void
  canvaImportEnabled?: boolean
  onStitchImport?: () => void
  stitchImportEnabled?: boolean
  onError?: (message: string | null) => void
  onClose: () => void
}

const PlugIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 22v-3" />
    <path d="M12 5V2" />
    <path d="M17 22v-3" />
    <path d="M17 5V2" />
    <rect x="5" y="5" width="14" height="10" rx="2" />
    <path d="M9 19h6" />
  </svg>
)

const FigmaIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
    <path
      fill="#f24e1e"
      d="M7 3h6a4 4 0 0 1 0 8H7V3zm0 8h7a4 4 0 0 1 0 8H7v-8zM7 3v16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3z"
    />
  </svg>
)

const CanvaIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
    <rect width="24" height="24" rx="5" fill="#00c4cc" />
    <circle cx="8.5" cy="12" r="3.15" fill="#7d2ae8" />
    <circle cx="12" cy="8.5" r="3.15" fill="#fff" />
    <circle cx="15.5" cy="13.5" r="3.15" fill="#ffc96b" />
  </svg>
)

const ArrowIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
)

export function WebStudioAttachMenu({
  disabled,
  projectId,
  images,
  onImagesChange,
  onCanvasImageImport,
  onFigmaImport,
  figmaImportEnabled = true,
  onCanvaImport,
  canvaImportEnabled = true,
  onStitchImport,
  stitchImportEnabled = true,
  onError,
  onClose,
}: WebStudioAttachMenuProps) {
  const { t, navigate } = useApp() as { t: (k: string) => string; navigate: (p: string) => void }
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    const next = [...images]
    let lastError: string | null = null

    for (const file of Array.from(files)) {
      if (next.length >= MAX_CHAT_IMAGES) {
        lastError = t('chat.attachMenu.maxImages').replace('{n}', String(MAX_CHAT_IMAGES))
        break
      }
      try {
        next.push(await addImageAttachment(file, undefined, projectId))
        onError?.(null)
      } catch (e) {
        lastError = e instanceof Error ? e.message : t('chat.attachMenu.invalidImage')
      }
    }

    if (lastError) onError?.(lastError)
    if (next.length > images.length) onImagesChange(next)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  const imageDisabled = disabled || images.length >= MAX_CHAT_IMAGES
  const figmaReady = Boolean(onFigmaImport) && figmaImportEnabled && !disabled
  const canvaReady = Boolean(onCanvaImport) && canvaImportEnabled && !disabled
  const stitchReady = Boolean(onStitchImport) && stitchImportEnabled && !disabled

  return (
    <div className="web-studio-attach-menu" role="menu" aria-label={t('chat.attachMenu.open')}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      <p className="web-studio-attach-menu__heading">{t('chat.attachMenu.attachSection')}</p>

      <button
        type="button"
        role="menuitem"
        className="web-studio-attach-menu__item"
        disabled={imageDisabled}
        aria-disabled={imageDisabled || undefined}
        onClick={() => fileRef.current?.click()}
      >
        <span className="web-studio-attach-menu__icon web-studio-attach-menu__icon--image" aria-hidden>
          <WsIcon.Image size={17} />
        </span>
        <span className="web-studio-attach-menu__body">
          <span className="web-studio-attach-menu__title">{t('chat.attachMenu.computer')}</span>
          <span className="web-studio-attach-menu__desc">{t('chat.attachMenu.imageDesc')}</span>
        </span>
      </button>

      <div className="web-studio-attach-menu__divider" role="separator" />
      <p className="web-studio-attach-menu__heading">{t('chat.attachMenu.importSection')}</p>

      <button
        type="button"
        role="menuitem"
        className={`web-studio-attach-menu__item${!figmaReady ? ' is-disabled' : ''}`}
        disabled={!figmaReady}
        aria-disabled={!figmaReady || undefined}
        onClick={() => {
          if (!figmaReady || !onFigmaImport) return
          onClose()
          onFigmaImport()
        }}
      >
        <span
          className="web-studio-attach-menu__icon web-studio-attach-menu__icon--figma"
          aria-hidden
        >
          <FigmaIcon />
        </span>
        <span className="web-studio-attach-menu__body">
          <span className="web-studio-attach-menu__title">{t('chat.attachMenu.figma')}</span>
          <span className="web-studio-attach-menu__desc">{t('ed.design.figmaAttachDesc')}</span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={`web-studio-attach-menu__item${!stitchReady ? ' is-disabled' : ''}`}
        disabled={!stitchReady}
        aria-disabled={!stitchReady || undefined}
        onClick={() => {
          if (!stitchReady || !onStitchImport) return
          onClose()
          onStitchImport()
        }}
      >
        <span
          className="web-studio-attach-menu__icon web-studio-attach-menu__icon--connect"
          aria-hidden
        >
          <WsIcon.LinkPath size={17} />
        </span>
        <span className="web-studio-attach-menu__body">
          <span className="web-studio-attach-menu__title">{t('chat.attachMenu.stitch')}</span>
          <span className="web-studio-attach-menu__desc">{t('chat.attachMenu.stitchDesc')}</span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={`web-studio-attach-menu__item${!canvaReady ? ' is-disabled' : ''}`}
        disabled={!canvaReady}
        aria-disabled={!canvaReady || undefined}
        onClick={() => {
          if (!canvaReady || !onCanvaImport) return
          onClose()
          onCanvaImport()
        }}
      >
        <span
          className="web-studio-attach-menu__icon web-studio-attach-menu__icon--canva"
          aria-hidden
        >
          <CanvaIcon />
        </span>
        <span className="web-studio-attach-menu__body">
          <span className="web-studio-attach-menu__title">{t('chat.attachMenu.canva')}</span>
          <span className="web-studio-attach-menu__desc">{t('chat.attachMenu.canvaDesc')}</span>
        </span>
      </button>

      {onCanvasImageImport ? (
        <button
          type="button"
          role="menuitem"
          className="web-studio-attach-menu__item"
          disabled={disabled}
          onClick={() => {
            onClose()
            onCanvasImageImport()
          }}
        >
          <span
            className="web-studio-attach-menu__icon web-studio-attach-menu__icon--import-canvas"
            aria-hidden
          >
            <WsIcon.RectDashed size={17} />
          </span>
          <span className="web-studio-attach-menu__body">
            <span className="web-studio-attach-menu__title">
              {t('chat.attachMenu.importCanvas')}
            </span>
            <span className="web-studio-attach-menu__desc">
              {t('chat.attachMenu.importCanvasDesc')}
            </span>
          </span>
        </button>
      ) : null}

      <div className="web-studio-attach-menu__divider" role="separator" />

      <p className="web-studio-attach-menu__heading">{t('chat.attachMenu.connectSection')}</p>

      <button
        type="button"
        role="menuitem"
        className="web-studio-attach-menu__item"
        onClick={() => {
          onClose()
          navigate('/settings?tab=connect')
        }}
      >
        <span className="web-studio-attach-menu__icon web-studio-attach-menu__icon--connect" aria-hidden>
          <PlugIcon />
        </span>
        <span className="web-studio-attach-menu__body">
          <span className="web-studio-attach-menu__title">{t('chat.attachMenu.connectors')}</span>
          <span className="web-studio-attach-menu__desc">{t('chat.attachMenu.connectorsDesc')}</span>
        </span>
        <span className="web-studio-attach-menu__arrow" aria-hidden>
          <ArrowIcon />
        </span>
      </button>
    </div>
  )
}
