'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { ChatModelMenu } from '@/components/chat/ChatModelMenu'
import { useImageModel } from '@/hooks/useImageModel'
import type { WorkspaceFileOption } from '@/components/chat/useChatFileMentions'
import { WebStudioAttachMenu } from '@/components/editor/webStudio/WebStudioAttachMenu'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import type { AIModelSelectOption } from '@/components/editor/AIModelSelect'
import type { CategoryModelChoices, ChatModelSelectionMode } from '@/lib/ai/chatModelChoices'
import type { ChatModelCategory } from '@/lib/ai/chatModelCategories'
import { useCloseOnClickOutside } from '@/hooks/useCloseOnClickOutside'
import {
  addImageAttachment,
  MAX_CHAT_IMAGES,
  pasteClipboardImages,
  type LocalImageAttachment,
} from '@/lib/chat/imageAttachments'
import {
  prepareDesignReferencePayloads,
  type DesignGenerateImagePayload,
} from '@/lib/design/designReferenceImages.client'
import { readClipboardImageFiles } from '@/lib/chat/readClipboardImages'
import {
  readDesignGenerateImagesPref,
  writeDesignGenerateImagesPref,
} from '@/lib/design/designGenerateImagesPref'
import type { DesignBrief } from '@/lib/design/designBrief'
import {
  elementPinsPromptSuffix,
  pagePinsPromptSuffix,
  type DesignElementContextPin,
  type DesignPageContextPin,
} from '@/lib/design/elementContext'
import { WebStudioElementContextMarker } from '@/components/editor/webStudio/WebStudioElementContextMarker'
import { WebStudioPageContextMarker } from '@/components/editor/webStudio/WebStudioPageContextMarker'
import { WebStudioAreaContextMarker } from '@/components/editor/webStudio/WebStudioAreaContextMarker'
import { buildCanvasPinsPromptSuffix, type CanvasPin } from '@/lib/visual-edit/canvasPins'
import { useImprovePrompt } from '@/hooks/useImprovePrompt'
import { useSpeechNotice } from '@/hooks/useSpeechNotice'
import { SpeechDictationButton } from '@/components/common/SpeechDictationButton'
import { SpeechDictationNotice } from '@/components/common/SpeechDictationNotice'
import { promptImpliesVisualReference } from '@/lib/design/designReferenceIntent'

function contextPathsSuffix(paths: string[]): string {
  if (!paths.length) return ''
  return `\n\n## Archivos de contexto (@)\nEl usuario marcó estos archivos como contexto prioritario:\n${paths.map((p) => `- \`${p}\``).join('\n')}`
}

export type WebStudioPromptBarHandle = {
  setValue: (value: string | ((prev: string) => string)) => void
  focus: () => void
  /** Cierra menús flotantes del compositor (+, modelo). */
  closeMenus: () => void
  /** Abre el selector de archivos de imagen del compositor. */
  openImageUpload: () => void
  /** Abre el selector de imagen y enfoca el compositor. */
  openImageUploadAndFocus: () => void
  /** Inserta una plantilla de prompt del menú Extras. */
  insertPromptTemplate: (i18nKey: string) => void
  /** Pega imágenes del portapapeles en el compositor. */
  pasteImages: () => Promise<void>
}

type WebStudioPromptBarProps = {
  disabled?: boolean
  generating?: boolean
  onStop?: () => void
  projectId?: string
  modelChoice?: string
  modelOptions?: AIModelSelectOption[]
  onModelChoiceChange?: (id: string) => void
  categoryChoices?: CategoryModelChoices
  categoryModels?: CategoryModelChoices
  selectionMode?: ChatModelSelectionMode
  onCategoryModelChange?: (category: ChatModelCategory, modelId: string) => void
  getWorkspaceFiles?: () => WorkspaceFileOption[]
  onSubmit: (
    prompt: string,
    opts?: {
      images?: DesignGenerateImagePayload[]
      generateImages?: boolean
      imageModelId?: string
      brief?: Partial<DesignBrief>
    },
  ) => void | Promise<void>
  onGithubImport?: () => void
  githubImportEnabled?: boolean
  onFigmaImport?: () => void
  figmaImportEnabled?: boolean
  onCanvaImport?: () => void
  canvaImportEnabled?: boolean
  onStitchImport?: () => void
  stitchImportEnabled?: boolean
  onCanvasImageImport?: () => void
  elementPins?: DesignElementContextPin[]
  onElementPinRemove?: (pin: DesignElementContextPin) => void
  canvasPins?: CanvasPin[]
  onCanvasPinRemove?: (id: string) => void
  pagePins?: DesignPageContextPin[]
  onPagePinRemove?: (pin: DesignPageContextPin) => void
  /** Tamaño y comportamiento del compositor en la landing (más grande que en studio). */
  variant?: 'studio' | 'hero'
  placeholder?: string
  onSpeechNotice?: (message: string | null) => void
}

export const WebStudioPromptBar = React.forwardRef<
  WebStudioPromptBarHandle,
  WebStudioPromptBarProps
>(function WebStudioPromptBar(props, ref) {
  const {
    disabled,
    generating = false,
    onStop,
    projectId,
    modelChoice = 'auto',
    modelOptions = [],
    onModelChoiceChange,
    categoryChoices,
    categoryModels,
    selectionMode,
    onCategoryModelChange,
    onSubmit,
    onGithubImport,
    githubImportEnabled = false,
    onFigmaImport,
    figmaImportEnabled = true,
    onCanvaImport,
    canvaImportEnabled = true,
    onStitchImport,
    stitchImportEnabled = true,
    onCanvasImageImport,
    elementPins = [],
    onElementPinRemove,
    canvasPins = [],
    onCanvasPinRemove,
    pagePins = [],
    onPagePinRemove,
    variant = 'studio',
    placeholder,
    onSpeechNotice,
  } = props
  const { t, speechDictationEnabled } = useApp() as {
    t: (key: string) => string
    speechDictationEnabled?: boolean
  }
  const { speechNotice, setSpeechNotice } = useSpeechNotice()
  const [value, setValue] = useState('')
  const [contextPaths, setContextPaths] = useState<string[]>([])
  const [images, setImages] = useState<LocalImageAttachment[]>([])
  const [generateImages, setGenerateImages] = useState(() => readDesignGenerateImagesPref())
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const attachAnchorRef = useRef<HTMLDivElement>(null)
  const {
    imageModelChoice,
    setImageModelChoice,
    options: imageModelOptions,
    designImageGenerationEnabled,
  } = useImageModel()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const isHero = variant === 'hero'
  const LINE_HEIGHT_PX = isHero ? 26 : 22
  const MIN_LINES = isHero ? 4 : 2
  const MAX_LINES = isHero ? 6 : 5
  const inputPlaceholder = placeholder ?? t('ed.design.promptPlaceholder')

  async function addImageFiles(files: File[]) {
    if (!files.length) return
    const next = [...images]
    let lastError: string | null = null
    for (const file of files) {
      if (next.length >= MAX_CHAT_IMAGES) {
        lastError = t('chat.attachMenu.maxImages').replace('{n}', String(MAX_CHAT_IMAGES))
        break
      }
      try {
        next.push(await addImageAttachment(file, undefined, projectId))
      } catch (e) {
        lastError = e instanceof Error ? e.message : t('chat.attachMenu.invalidImage')
      }
    }
    if (lastError) setAttachError(lastError)
    if (next.length > images.length) {
      setImages(next.slice(0, MAX_CHAT_IMAGES))
      setAttachError(null)
    }
    textareaRef.current?.focus()
  }

  React.useImperativeHandle(ref, () => ({
    setValue: (val) => setValue(val),
    focus: () => textareaRef.current?.focus(),
    closeMenus: () => {
      setAttachMenuOpen(false)
      setModelMenuOpen(false)
    },
    openImageUpload: () => uploadInputRef.current?.click(),
    openImageUploadAndFocus: () => {
      uploadInputRef.current?.click()
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    },
    insertPromptTemplate: (i18nKey: string) => {
      setValue(t(i18nKey))
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    },
    pasteImages: async () => {
      const fromClipboard = await readClipboardImageFiles()
      if (fromClipboard.length) {
        await addImageFiles(fromClipboard)
        return
      }
      textareaRef.current?.focus()
    },
  }))

  const showModel = Boolean(modelOptions.length && onModelChoiceChange)
  const menusOpen = attachMenuOpen || modelMenuOpen
  const controlsDisabled = Boolean(disabled || generating)
  const handleSpeechNotice = useCallback(
    (message: string | null) => {
      setSpeechNotice(message)
      onSpeechNotice?.(message)
    },
    [onSpeechNotice, setSpeechNotice],
  )
  const { improvingPrompt, handleImprovePrompt, canImprovePrompt } = useImprovePrompt({
    getText: () => value,
    setText: setValue,
    modelChoice,
    categoryModels,
    loading: generating,
    disabled: controlsDisabled,
    onError: (message) => setAttachError(message),
  })

  useEffect(() => {
    writeDesignGenerateImagesPref(generateImages)
  }, [generateImages])

  useEffect(() => {
    if (!generating) return
    setAttachMenuOpen(false)
    setModelMenuOpen(false)
  }, [generating])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT_PX * MAX_LINES
    const minHeight = LINE_HEIGHT_PX * MIN_LINES
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`
  }, [value])

  useCloseOnClickOutside(attachAnchorRef, attachMenuOpen, () => setAttachMenuOpen(false))

  async function handlePasteImages(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const result = await pasteClipboardImages(e, {
      current: images,
      projectId,
      maxImagesLabel: t('chat.attachMenu.maxImages'),
      invalidImageLabel: t('chat.attachMenu.invalidImage'),
    })
    if (!result) return
    if (result.added.length) {
      setImages((prev) => [...prev, ...result.added].slice(0, MAX_CHAT_IMAGES))
      setAttachError(null)
    } else if (result.error) {
      setAttachError(result.error)
    }
  }

  async function onUploadInputChange(files: FileList | null) {
    if (!files?.length) return
    await addImageFiles(Array.from(files))
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const imgs = images
    let prompt = value.trim()
    const hasMarkers =
      canvasPins.length > 0 || elementPins.length > 0 || pagePins.length > 0
    if (!prompt && !imgs.length && !hasMarkers && !isHero) return
    if (controlsDisabled) return
    if (!prompt && imgs.length) {
      prompt = t('ed.design.promptFromImages')
    }
    if (!imgs.length && promptImpliesVisualReference(prompt)) {
      setAttachError(t('ed.design.referenceImageRequired'))
      return
    }
    if (contextPaths.length) prompt += contextPathsSuffix(contextPaths)
    if (pagePins.length) prompt += pagePinsPromptSuffix(pagePins)
    if (elementPins.length) prompt += elementPinsPromptSuffix(elementPins)
    if (canvasPins.length) prompt += buildCanvasPinsPromptSuffix(canvasPins)

    let imagePayloads: DesignGenerateImagePayload[] = []
    if (imgs.length) {
      try {
        imagePayloads = await prepareDesignReferencePayloads(imgs, { projectId })
      } catch (err) {
        setAttachError(
          err instanceof Error ? err.message : t('ed.design.referenceImagePrepareFailed'),
        )
        return
      }
      if (!imagePayloads.length) {
        setAttachError(t('ed.design.referenceImageUnresolved'))
        return
      }
    }

    setValue('')
    setContextPaths([])
    setImages([])
    setAttachMenuOpen(false)
    await onSubmit(prompt, {
      images: imagePayloads.length ? imagePayloads : undefined,
      generateImages,
      imageModelId: generateImages ? imageModelChoice : undefined,
    })
  }

  const canSend = isHero
    ? !controlsDisabled
    : Boolean(
        value.trim() ||
          images.length ||
          canvasPins.length ||
          elementPins.length ||
          pagePins.length,
      )

  const hasContextMarkers =
    elementPins.length > 0 || canvasPins.length > 0 || pagePins.length > 0
  const hasAttachments = images.length > 0

  return (
    <div
      className={`web-studio-prompt-host${isHero ? ' web-studio-prompt-host--hero' : ''}${menusOpen ? ' web-studio-prompt-host--menus-open' : ''}`}
    >
      <div
        className={`web-studio-prompt-card${menusOpen ? ' is-menu-open' : ''}${hasContextMarkers ? ' web-studio-prompt-card--has-context' : ''}${hasAttachments ? ' web-studio-prompt-card--has-attachments' : ' web-studio-prompt-card--no-attachments'}${speechNotice && speechDictationEnabled ? ' web-studio-prompt-card--speech-notice' : ''}`}
      >
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          data-testid="studio-reference-file-input"
          onChange={(e) => void onUploadInputChange(e.target.files)}
        />
        <form className="web-studio-prompt" onSubmit={(e) => void handleSubmit(e)}>
          {speechNotice && speechDictationEnabled ? (
            <SpeechDictationNotice message={speechNotice} />
          ) : null}
          {pagePins.length || elementPins.length || canvasPins.length ? (
            <div className="web-studio-prompt__context-markers">
              {pagePins.map((pin) => (
                <WebStudioPageContextMarker
                  key={pin.pageId}
                  pin={pin}
                  onRemove={() => onPagePinRemove?.(pin)}
                />
              ))}
              {elementPins.map((pin) => (
                <WebStudioElementContextMarker
                  key={`${pin.pageId}:${pin.skId}`}
                  pin={pin}
                  onRemove={() => onElementPinRemove?.(pin)}
                />
              ))}
              {canvasPins.map((pin) => (
                <WebStudioAreaContextMarker
                  key={pin.id}
                  pin={pin}
                  onRemove={() => onCanvasPinRemove?.(pin.id)}
                />
              ))}
            </div>
          ) : null}

          {hasAttachments ? (
            <div
              className="web-studio-prompt__attachments"
              aria-label={t('chat.attachMenu.attachSection')}
            >
              {images.map((img) => (
                <span key={img.id} className="web-studio-prompt__attachment">
                  <img src={img.previewUrl} alt={img.name} width={32} height={32} />
                  <button
                    type="button"
                    className="web-studio-prompt__attachment-remove"
                    aria-label={t('ed.design.removeContext')}
                    disabled={controlsDisabled}
                    onClick={() => setImages((prev) => prev.filter((x) => x.id !== img.id))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {attachError ? (
            <p className="web-studio-prompt__attach-error" role="alert">
              {attachError}
            </p>
          ) : null}

          <div className="web-studio-prompt__composer">
            <textarea
              ref={textareaRef}
              className="web-studio-prompt__input"
              rows={MIN_LINES}
              placeholder={inputPlaceholder}
              value={value}
              disabled={controlsDisabled}
              aria-label={inputPlaceholder}
              onChange={(e) => setValue(e.target.value)}
              onPaste={(e) => void handlePasteImages(e)}
              onKeyDown={(e) => {
                if (generating) return
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
            />
          </div>

          <div className="web-studio-prompt__toolbar">
            <div className="web-studio-prompt__toolbar-start">
              <div ref={attachAnchorRef} className="web-studio-prompt__attach-anchor">
                {attachMenuOpen ? (
                  <WebStudioAttachMenu
                    disabled={controlsDisabled}
                    projectId={projectId}
                    images={images}
                    onImagesChange={setImages}
                    onCanvasImageImport={onCanvasImageImport}
                    onFigmaImport={onFigmaImport}
                    figmaImportEnabled={figmaImportEnabled}
                    onCanvaImport={onCanvaImport}
                    canvaImportEnabled={canvaImportEnabled}
                    onStitchImport={onStitchImport}
                    stitchImportEnabled={stitchImportEnabled}
                    onError={setAttachError}
                    onClose={() => setAttachMenuOpen(false)}
                  />
                ) : null}
                <button
                  type="button"
                  className={`web-studio-prompt__tool${attachMenuOpen ? ' is-active' : ''}`}
                  aria-label={t('chat.attachMenu.open')}
                  aria-expanded={attachMenuOpen}
                  disabled={controlsDisabled && !attachMenuOpen}
                  onClick={() => {
                    setModelMenuOpen(false)
                    setAttachMenuOpen((v) => !v)
                  }}
                >
                  <WsIcon.Add />
                </button>
              </div>
            </div>

            <div className="web-studio-prompt__toolbar-end">
              <button
                type="button"
                className={`web-studio-prompt__improve${improvingPrompt ? ' is-loading' : ''}`}
                disabled={controlsDisabled || improvingPrompt || !canImprovePrompt}
                onClick={() => void handleImprovePrompt()}
                aria-label={improvingPrompt ? t('ed.improvingPrompt') : t('ed.improvePrompt')}
                title={improvingPrompt ? t('ed.improvingPromptBatch') : t('ed.improvePromptBatchHint')}
              >
                {improvingPrompt ? (
                  <span className="chat-composer-improve-btn__spinner" aria-hidden />
                ) : (
                  <svg
                    className="composer-icon-stars"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                    <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z" />
                    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z" />
                  </svg>
                )}
              </button>

              {speechDictationEnabled ? (
                <SpeechDictationButton
                  getText={() => value}
                  setText={setValue}
                  disabled={controlsDisabled}
                  className="web-studio-prompt__speech chat-composer-speech-btn"
                  onNotice={handleSpeechNotice}
                />
              ) : null}

              {showModel ? (
                <div className="web-studio-prompt__model-menu">
                  <ChatModelMenu
                    value={modelChoice}
                    options={modelOptions}
                    onChange={onModelChoiceChange!}
                    categoryChoices={categoryChoices}
                    selectionMode={selectionMode}
                    onCategoryModelChange={onCategoryModelChange}
                    imageModelValue={imageModelChoice}
                    imageModelOptions={imageModelOptions}
                    generateImages={generateImages}
                    onGenerateImagesChange={setGenerateImages}
                    onImageModelChange={setImageModelChoice}
                    imageGenerationDisabled={!designImageGenerationEnabled}
                    disabled={controlsDisabled}
                    triggerVariant="pill"
                    open={modelMenuOpen}
                    onOpenChange={(open) => {
                      setModelMenuOpen(open)
                      if (open) {
                        setAttachMenuOpen(false)
                      }
                    }}
                  />
                </div>
              ) : null}
              {generating ? (
                <button
                  type="button"
                  className="web-studio-prompt__send web-studio-prompt__send--stop"
                  onClick={() => onStop?.()}
                  aria-label={t('ed.stop')}
                >
                  <span className="chat-composer-stop-icon" aria-hidden>
                    <span className="chat-composer-stop-icon__sq" />
                  </span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="web-studio-prompt__send"
                  disabled={controlsDisabled || !canSend}
                  aria-label={t('ed.send')}
                >
                  <Icon.Arrow />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
})

WebStudioPromptBar.displayName = 'WebStudioPromptBar'
