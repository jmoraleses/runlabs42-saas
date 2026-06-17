'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import { Modal } from '@/components/ui/Modal'

type ProjectDeleteConfirmDialogProps = {
  open: boolean
  count: number
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ProjectDeleteConfirmDialog({
  open,
  count,
  busy,
  onConfirm,
  onCancel,
}: ProjectDeleteConfirmDialogProps) {
  const { t } = useApp() as { t: (k: string) => string }

  const title =
    count > 1
      ? t('projects.deleteConfirmTitleMany').replace('{n}', String(count))
      : t('projects.deleteConfirmTitleOne')

  const body =
    count > 1
      ? t('projects.deleteConfirmBodyMany').replace('{n}', String(count))
      : t('projects.deleteConfirmBodyOne')

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="projects-delete-title"
      panelClassName="close-chat-modal"
    >
      <h2 id="projects-delete-title" className="close-chat-modal__title">
        {title}
      </h2>
      <p className="close-chat-modal__body">{body}</p>
      <div className="close-chat-modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('projects.deleteConfirmCancel')}
        </button>
        <button
          type="button"
          className="btn close-chat-modal__confirm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? t('projects.action.working') : t('projects.deleteConfirmSubmit')}
        </button>
      </div>
    </Modal>
  )
}
