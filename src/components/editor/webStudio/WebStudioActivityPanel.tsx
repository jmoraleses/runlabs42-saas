'use client'

import React, { useEffect, useRef } from 'react'
import { useApp } from '@/components/app/shell'
import {
  DesignAgentLog,
  type DesignAgentPhaseBlock,
} from '@/components/editor/DesignAgentLog'

type WebStudioActivityPanelProps = {
  phases: DesignAgentPhaseBlock[]
  building?: boolean
}

export function WebStudioActivityPanel({ phases, building }: WebStudioActivityPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const bodyRef = useRef<HTMLDivElement>(null)

  const stepCount = phases.reduce((n, p) => n + p.steps.length, 0)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [stepCount, building])

  return (
    <aside className="web-studio-activity-panel" aria-live="polite" aria-busy={building || undefined}>
      <header className="web-studio-activity-panel__head">
        <p className="web-studio-activity-panel__eyebrow">{t('ed.design.agentLog')}</p>
      </header>
      <div ref={bodyRef} className="web-studio-activity-panel__body">
        <DesignAgentLog phases={phases} building={building} variant="studio" compact />
      </div>
    </aside>
  )
}
