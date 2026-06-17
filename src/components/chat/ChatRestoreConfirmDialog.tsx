'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import { Modal } from '@/components/ui/Modal'

type ChatRestoreConfirmDialogProps = {
  open: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ChatRestoreConfirmDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: ChatRestoreConfirmDialogProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="chat-restore-title"
      panelClassName="close-chat-modal"
    >
      <h2 id="chat-restore-title" className="close-chat-modal__title">
        {t('ed.chatRestore.title')}
      </h2>
      <p className="close-chat-modal__body">{t('ed.chatRestore.body')}</p>
      <div className="close-chat-modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('ed.chatRestore.cancel')}
        </button>
        <button
          type="button"
          className="btn close-chat-modal__confirm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? t('projects.action.working') : t('ed.chatRestore.confirm')}
        </button>
      </div>
    </Modal>
  )
}
