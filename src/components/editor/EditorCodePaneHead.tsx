'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type EditorCodePaneHeadProps = {
  fileName: string
  onSave?: () => void
  saving?: boolean
  saved?: boolean
  canSave?: boolean
}

export function EditorCodePaneHead({
  fileName,
  onSave,
  saving = false,
  saved = false,
  canSave = false,
}: EditorCodePaneHeadProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div className="editor-code-pane-head">
      <span className="mono editor-code-pane-head__name">{fileName}</span>
      {onSave ? (
        <div className="editor-code-pane-head__actions">
          {saved ? <span className="settings-save-toast">{t('ed.filesSaved')}</span> : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !canSave}
            onClick={onSave}
            title={canSave ? t('ed.filesSave') : t('ed.filesSaveNothing')}
          >
            {saving ? t('ed.filesSaving') : t('ed.filesSave')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
