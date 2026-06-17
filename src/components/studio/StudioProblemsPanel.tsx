'use client'

import { useApp } from '@/components/app/shell'

type StudioProblemsPanelProps = {
  errors: string[]
  compileFixAttempt?: number
  maxAttempts?: number
  previewFixGaveUp?: boolean
  onFixWithAi?: () => void
  onDismiss?: () => void
}

export function StudioProblemsPanel({
  errors,
  compileFixAttempt = 0,
  maxAttempts = 4,
  previewFixGaveUp,
  onFixWithAi,
  onDismiss,
}: StudioProblemsPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }

  if (!errors.length) return null

  const primary = errors[0]

  return (
    <aside className="studio-problems-panel" aria-label={t('ed.problems.title')}>
      <div className="studio-problems-panel__head">
        <strong>{t('ed.problems.title')}</strong>
        {compileFixAttempt > 0 && compileFixAttempt <= maxAttempts ? (
          <span className="studio-problems-panel__attempt">
            {t('ed.compileFix.attempt')
              .replace('{n}', String(compileFixAttempt))
              .replace('{max}', String(maxAttempts))}
          </span>
        ) : null}
        {onDismiss ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
            ×
          </button>
        ) : null}
      </div>
      <pre className="studio-problems-panel__message">{primary}</pre>
      {errors.length > 1 ? (
        <p className="studio-problems-panel__more">
          +{errors.length - 1} {t('ed.problems.more')}
        </p>
      ) : null}
      {previewFixGaveUp && onFixWithAi ? (
        <button type="button" className="btn btn-sm btn-primary" onClick={onFixWithAi}>
          {t('ed.compileFix.manual')}
        </button>
      ) : null}
    </aside>
  )
}
