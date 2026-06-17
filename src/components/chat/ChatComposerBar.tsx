'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { ChatAttachMenu } from '@/components/chat/ChatAttachMenu'
import { ChatFileContextButton } from '@/components/chat/ChatFileContextButton'
import { ComposerToolButton } from '@/components/chat/ComposerToolButton'
import type { WorkspaceFileOption } from '@/components/chat/useChatFileMentions'
import { ChatModelMenu } from '@/components/chat/ChatModelMenu'
import { SpeechDictationButton } from '@/components/common/SpeechDictationButton'
import type { AIModelSelectOption } from '@/components/editor/AIModelSelect'
import { MAX_CHAT_IMAGES, type LocalImageAttachment } from '@/lib/chat/imageAttachments'
import type { ThinkingLevel } from '@/lib/ai/models'
import type { CategoryModelChoices, ChatModelSelectionMode } from '@/lib/ai/chatModelChoices'
import type { ChatModelCategory } from '@/lib/ai/chatModelCategories'

type ChatComposerBarProps = {
  variant?: 'hero' | 'editor'
  disabled?: boolean
  loading?: boolean
  canSend: boolean
  onSend: () => void
  /** Autocorregir errores de compilación tras respuestas del chat. */
  autofixEnabled?: boolean
  onAutofixEnabledChange?: (enabled: boolean) => void
  /** Corta el stream activo; si se define, el botón de enviar pasa a «parar» mientras `loading`. */
  onStop?: () => void
  images: LocalImageAttachment[]
  onImagesChange: (images: LocalImageAttachment[]) => void
  modelChoice?: string
  modelOptions?: AIModelSelectOption[]
  onModelChoiceChange?: (id: string) => void
  categoryChoices?: CategoryModelChoices
  selectionMode?: ChatModelSelectionMode
  onCategoryModelChange?: (category: ChatModelCategory, modelId: string) => void
  thinkingLevel?: ThinkingLevel
  onThinkingLevelChange?: (level: ThinkingLevel) => void
  hint?: string
  attachError?: string | null
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
  onAttachError?: (message: string | null) => void
  onSpeechNotice?: (message: string | null) => void
  onImprovePrompt?: () => void
  improvingPrompt?: boolean
  canImprovePrompt?: boolean
  getComposerText?: () => string
  setComposerText?: (text: string) => void
  /** Adjuntar archivos del proyecto como contexto (@). */
  getWorkspaceFiles?: () => WorkspaceFileOption[]
  contextFilePaths?: string[]
  onAddContextFile?: (path: string) => void
}

export function ChatComposerBar({
  variant = 'hero',
  disabled,
  loading,
  canSend,
  onSend,
  autofixEnabled = true,
  onAutofixEnabledChange,
  onStop,
  images,
  onImagesChange,
  modelChoice,
  modelOptions,
  onModelChoiceChange,
  categoryChoices,
  selectionMode,
  onCategoryModelChange,
  thinkingLevel,
  onThinkingLevelChange,
  hint,
  attachError,
  chatSessionId,
  projectId,
  onGithubImport,
  githubImportEnabled,
  onFigmaImport,
  figmaImportEnabled,
  onCanvaImport,
  canvaImportEnabled,
  onStitchImport,
  stitchImportEnabled,
  onAttachError,
  onSpeechNotice,
  onImprovePrompt,
  improvingPrompt,
  canImprovePrompt,
  getComposerText,
  setComposerText,
  getWorkspaceFiles,
  contextFilePaths = [],
  onAddContextFile,
}: ChatComposerBarProps) {
  const { t, speechDictationEnabled } = useApp() as {
    t: (k: string) => string
    speechDictationEnabled?: boolean
  }
  const showModel = Boolean(modelOptions?.length && onModelChoiceChange && modelChoice)
  const isStreaming = Boolean(loading && onStop)
  const submitClass =
    variant === 'hero'
      ? 'hero-prompt-card__submit'
      : 'editor-chat-send-btn editor-chat-send-btn--aria'

  return (
    <>
      <div className={`chat-composer-toolbar chat-composer-toolbar--${variant}`}>
        <div className="chat-composer-toolbar__left">
          <ChatAttachMenu
            mode={variant === 'editor' ? 'editor' : 'images'}
            images={images}
            onImagesChange={onImagesChange}
            maxImages={MAX_CHAT_IMAGES}
            disabled={disabled || loading}
            chatSessionId={chatSessionId}
            projectId={projectId}
            onGithubImport={onGithubImport}
            githubImportEnabled={githubImportEnabled}
            onFigmaImport={onFigmaImport}
            figmaImportEnabled={figmaImportEnabled}
            onCanvaImport={onCanvaImport}
            canvaImportEnabled={canvaImportEnabled}
            onStitchImport={onStitchImport}
            stitchImportEnabled={stitchImportEnabled}
            onError={onAttachError}
          />
          {variant === 'editor' && getWorkspaceFiles && onAddContextFile ? (
            <ChatFileContextButton
              getFiles={getWorkspaceFiles}
              contextPaths={contextFilePaths}
              onAddPath={onAddContextFile}
              disabled={disabled || loading}
            />
          ) : null}
          {showModel && (
            <ChatModelMenu
              value={modelChoice!}
              options={modelOptions!}
              onChange={onModelChoiceChange!}
              categoryChoices={categoryChoices}
              selectionMode={selectionMode}
              onCategoryModelChange={onCategoryModelChange}
              disabled={disabled || loading}
            />
          )}
        </div>
        <div className="chat-composer-toolbar__right">
          {hint && variant === 'hero' && (
            <span className="chat-composer__hint">{hint}</span>
          )}
          <div className="chat-composer-toolbar__plan-group">
            {onAutofixEnabledChange ? (
              <ComposerToolButton
                label={autofixEnabled ? t('ed.autofix.on') : t('ed.autofix.off')}
                active={autofixEnabled}
                disabled={disabled}
                onClick={() => onAutofixEnabledChange(!autofixEnabled)}
              >
                <Icon.Infinity />
              </ComposerToolButton>
            ) : null}
          </div>

          {onImprovePrompt ? (
            variant === 'editor' ? (
              <button
                type="button"
                className={`chat-composer-improve-btn chat-composer-improve-btn--labeled${improvingPrompt ? ' is-loading' : ''}`}
                disabled={disabled || loading || improvingPrompt || !canImprovePrompt}
                onClick={onImprovePrompt}
                aria-label={improvingPrompt ? t('ed.improvingPrompt') : t('ed.improvePrompt')}
                title={improvingPrompt ? t('ed.improvingPromptBatch') : t('ed.improvePromptBatchHint')}
              >
                {improvingPrompt ? (
                  <span className="chat-composer-improve-btn__spinner" aria-hidden />
                ) : (
                  <svg className="composer-icon-stars" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
                    <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z"/>
                    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/>
                  </svg>
                )}
                <span className="chat-composer-improve-btn__label">
                  {improvingPrompt ? t('ed.improvingPrompt') : t('ed.improvePrompt')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="chat-composer-improve-btn"
                disabled={disabled || loading || improvingPrompt || !canImprovePrompt}
                onClick={onImprovePrompt}
                aria-label={improvingPrompt ? t('ed.improvingPrompt') : t('ed.improvePrompt')}
                title={improvingPrompt ? t('ed.improvingPrompt') : t('ed.improvePrompt')}
              >
                {improvingPrompt ? (
                  <span className="chat-composer-improve-btn__spinner" aria-hidden />
                ) : (
                  <svg className="composer-icon-stars" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
                    <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z"/>
                    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/>
                  </svg>
                )}
              </button>
            )
          ) : null}
          {getComposerText && setComposerText && speechDictationEnabled ? (
            <SpeechDictationButton
              getText={getComposerText}
              setText={setComposerText}
              disabled={disabled || loading}
              onNotice={onSpeechNotice}
            />
          ) : null}
          <button
            type="button"
            className={`${submitClass}${isStreaming ? ' chat-composer-submit--stop' : ''}`}
            disabled={disabled || (isStreaming ? false : loading || !canSend)}
            onClick={isStreaming ? onStop : onSend}
            aria-label={
              isStreaming
                ? t('ed.stop')
                : variant === 'hero'
                  ? t('hero.prompt.submit')
                  : t('ed.send')
            }
          >
            {isStreaming ? (
              <span className="chat-composer-stop-icon" aria-hidden>
                <span className="chat-composer-stop-icon__sq" />
              </span>
            ) : (
              <Icon.Arrow />
            )}
          </button>
        </div>
      </div>
      {attachError && <span className="chat-composer__error">{attachError}</span>}
    </>
  )
}
