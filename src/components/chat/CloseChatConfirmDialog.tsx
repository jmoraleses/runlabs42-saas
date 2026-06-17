'use client'

import React, { useEffect, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { Modal } from '@/components/ui/Modal'

export const SKIP_CHAT_CLOSE_CONFIRM_KEY = 'runlabs42.skipChatCloseConfirm'

type CloseChatConfirmDialogProps = {
  open: boolean
  onConfirm: (skipNextTime: boolean) => void
  onCancel: () => void
}

function ChatCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M12 3a6 6 0 0 0-6 6v7a2 2 0 0 0 2 2h1.5l1.2 2.4a1 1 0 0 0 1.8 0L13.5 18H16a2 2 0 0 0 2-2V9a6 6 0 0 0-6-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 10h6M9 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CloseChatConfirmDialog({ open, onConfirm, onCancel }: CloseChatConfirmDialogProps) {
  const { t } = useApp() as { t: (k: string) => string }
  const [skip, setSkip] = useState(false)

  useEffect(() => {
    if (!open) setSkip(false)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="close-chat-title"
      panelClassName="close-chat-modal"
    >
      <div className="close-chat-modal__icon" aria-hidden>
        <ChatCloseIcon />
      </div>

      <h2 id="close-chat-title" className="close-chat-modal__title">
        {t('chat.closeConfirm.title')}
      </h2>

      <p className="close-chat-modal__body">{t('chat.closeConfirm.body')}</p>

      <div className="close-chat-modal__notice" role="note">
        <span className="close-chat-modal__notice-dot" aria-hidden />
        <span>{t('chat.closeConfirm.notice')}</span>
      </div>

      <label className="close-chat-modal__skip">
        <input
          type="checkbox"
          className="close-chat-modal__checkbox"
          checked={skip}
          onChange={(e) => setSkip(e.target.checked)}
        />
        <span>{t('chat.closeConfirm.skip')}</span>
      </label>

      <div className="close-chat-modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('chat.closeConfirm.cancel')}
        </button>
        <button
          type="button"
          className="btn close-chat-modal__confirm"
          onClick={() => onConfirm(skip)}
        >
          {t('chat.closeConfirm.confirm')}
        </button>
      </div>
    </Modal>
  )
}
