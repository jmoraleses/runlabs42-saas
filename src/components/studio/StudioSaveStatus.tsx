'use client'

import { useApp } from '@/components/app/shell'
import type { StudioProjectMode } from '@/hooks/studio/useStudioProjectLifecycle'

type StudioSaveStatusProps = {
  mode: StudioProjectMode
  fileSaving: boolean
  hasUnsavedEdits: boolean
  projectId: string | null
}

export function StudioSaveStatus({
  mode,
  fileSaving,
  hasUnsavedEdits,
  projectId,
}: StudioSaveStatusProps) {
  const { t } = useApp() as { t: (key: string) => string }

  let state: 'draft' | 'saving' | 'dirty' | 'saved' = 'saved'
  if (mode === 'draft' && !projectId) state = 'draft'
  else if (fileSaving) state = 'saving'
  else if (hasUnsavedEdits) state = 'dirty'
  else state = 'saved'

  const label =
    state === 'draft'
      ? t('ed.saveStatus.draft')
      : state === 'saving'
        ? t('ed.saveStatus.saving')
        : state === 'dirty'
          ? t('ed.saveStatus.unsaved')
          : t('ed.saveStatus.saved')

  return (
    <span
      className="studio-save-status"
      data-state={state}
      title={label}
    >
      {label}
    </span>
  )
}
