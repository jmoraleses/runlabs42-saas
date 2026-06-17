'use client'

import React, { useState } from 'react'
import { ChatAttachmentPreviews } from '@/components/chat/ChatAttachmentPreviews'
import { ChatComposerBar } from '@/components/chat/ChatComposerBar'
import { useApp } from '@/components/app/shell'
import { useImprovePrompt } from '@/hooks/useImprovePrompt'
import { useSpeechNotice } from '@/hooks/useSpeechNotice'
import { SpeechDictationNotice } from '@/components/common/SpeechDictationNotice'
import type { AIModelSelectOption } from '@/components/editor/AIModelSelect'
import type { LocalImageAttachment } from '@/lib/chat/imageAttachments'
import type { ThinkingLevel } from '@/lib/ai/models'
import type { CategoryModelChoices, ChatModelSelectionMode } from '@/lib/ai/chatModelChoices'
import type { ChatModelCategory } from '@/lib/ai/chatModelCategories'

export type ChatComposerSubmit = {
  text: string
  images: LocalImageAttachment[]
}

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (payload: ChatComposerSubmit) => void
  modelChoice?: string
  modelOptions?: AIModelSelectOption[]
  onModelChoiceChange?: (id: string) => void
  categoryChoices?: CategoryModelChoices
  selectionMode?: ChatModelSelectionMode
  onCategoryModelChange?: (category: ChatModelCategory, modelId: string) => void
  thinkingLevel?: ThinkingLevel
  onThinkingLevelChange?: (level: ThinkingLevel) => void
  autofixEnabled?: boolean
  onAutofixEnabledChange?: (enabled: boolean) => void
  onStop?: () => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  variant?: 'hero' | 'editor'
  hint?: string
  id?: string
  chatSessionId?: string
  onGithubImport?: () => void
  githubImportEnabled?: boolean
  attachError?: string | null
  onAttachError?: (message: string | null) => void
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  modelChoice,
  modelOptions,
  onModelChoiceChange,
  categoryChoices,
  selectionMode,
  onCategoryModelChange,
  thinkingLevel,
  onThinkingLevelChange,
  autofixEnabled,
  onAutofixEnabledChange,
  onStop,
  placeholder,
  disabled,
  loading,
  variant = 'hero',
  hint,
  id = 'chat-composer',
  chatSessionId,
  onGithubImport,
  githubImportEnabled,
  attachError,
  onAttachError,
}: ChatComposerProps) {
  const [images, setImages] = useState<LocalImageAttachment[]>([])
  const { speechDictationEnabled } = useApp() as { speechDictationEnabled?: boolean }
  const [localAttachError, setLocalAttachError] = useState<string | null>(null)
  const { speechNotice, setSpeechNotice } = useSpeechNotice()
  const displayAttachError = attachError ?? localAttachError
  const { improvingPrompt, handleImprovePrompt, canImprovePrompt } = useImprovePrompt({
    getText: () => value,
    setText: onChange,
    modelChoice,
    loading,
    disabled,
  })

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault?.()
    const text = value.trim()
    const hasContent = Boolean(text || images.length)
    if (variant !== 'hero' && !hasContent) return
    if (loading || disabled) return
    onSubmit({ text, images })
    setImages([])
  }

  const canSend =
    variant === 'hero'
      ? !disabled && !loading
      : Boolean(value.trim() || images.length)

  const rootClass =
    variant === 'hero' ? 'hero-prompt-card chat-composer' : 'editor-chat-composer chat-composer'

  return (
    <form
      className={`${rootClass}${speechNotice && speechDictationEnabled ? ' chat-composer--speech-notice' : ''}`}
      onSubmit={handleSubmit}
    >
      {speechNotice && speechDictationEnabled ? (
        <SpeechDictationNotice message={speechNotice} />
      ) : null}
      <ChatAttachmentPreviews
        attachments={images}
        onRemove={(id) => setImages((list) => list.filter((x) => x.id !== id))}
      />

      <textarea
        id={id}
        className={variant === 'hero' ? 'hero-prompt-card__input' : 'editor-chat-input'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={variant === 'hero' ? 5 : 2}
        disabled={disabled || loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />

      <ChatComposerBar
        variant={variant}
        disabled={disabled}
        loading={loading}
        canSend={canSend}
        onSend={() => handleSubmit()}
        onStop={onStop}
        autofixEnabled={autofixEnabled}
        onAutofixEnabledChange={onAutofixEnabledChange}
        images={images}
        onImagesChange={setImages}
        modelChoice={modelChoice}
        modelOptions={modelOptions}
        onModelChoiceChange={onModelChoiceChange}
        categoryChoices={categoryChoices}
        selectionMode={selectionMode}
        onCategoryModelChange={onCategoryModelChange}
        thinkingLevel={thinkingLevel}
        onThinkingLevelChange={onThinkingLevelChange}
        hint={hint}
        chatSessionId={chatSessionId}
        onGithubImport={onGithubImport}
        githubImportEnabled={githubImportEnabled}
        attachError={displayAttachError}
        onAttachError={onAttachError ?? setLocalAttachError}
        onSpeechNotice={speechDictationEnabled ? setSpeechNotice : undefined}
        onImprovePrompt={handleImprovePrompt}
        improvingPrompt={improvingPrompt}
        canImprovePrompt={canImprovePrompt}
        getComposerText={() => value}
        setComposerText={onChange}
      />
    </form>
  )
}
