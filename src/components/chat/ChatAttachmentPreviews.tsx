'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import type { LocalImageAttachment } from '@/lib/chat/imageAttachments'

type ChatAttachmentPreviewsProps = {
  attachments: LocalImageAttachment[]
  onRemove: (id: string) => void
}

export function ChatAttachmentPreviews({ attachments, onRemove }: ChatAttachmentPreviewsProps) {
  const { t } = useApp() as { t: (key: string) => string }

  if (!attachments.length) return null

  return (
    <div className="chat-composer__attachments" role="list" aria-label={t('chat.attachImage')}>
      {attachments.map((img) => (
        <div key={img.id} className="chat-composer__thumb" role="listitem">
          <img src={img.previewUrl} alt={img.name} />
          <button
            type="button"
            className="chat-composer__thumb-remove"
            aria-label={t('chat.removeImage')}
            onClick={() => onRemove(img.id)}
          >
            <Icon.X />
          </button>
        </div>
      ))}
    </div>
  )
}
