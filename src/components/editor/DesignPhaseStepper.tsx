'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type DesignPhaseStepperProps = {
  designPhase: 'design' | 'code'
  designApprovedAt: string | null
  hasMockup: boolean
  hasAppCode: boolean
  isPublished?: boolean
  className?: string
}

export function DesignPhaseStepper({
  designPhase,
  designApprovedAt,
  hasMockup,
  hasAppCode,
  isPublished = false,
  className = '',
}: DesignPhaseStepperProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const phase1Done = hasMockup || designPhase === 'code'
  const phase2Done = designPhase === 'code' && hasAppCode
  const phase3Done = isPublished
  const phase3Active = phase2Done && !phase3Done

  const steps = [
    {
      id: 'design',
      label: t('ed.design.phase.design'),
      done: phase1Done,
      active: designPhase === 'design' && hasMockup,
    },
    {
      id: 'code',
      label: t('ed.design.phase.code'),
      done: phase2Done,
      active: designPhase === 'code' || (phase1Done && !phase2Done),
    },
    {
      id: 'publish',
      label: t('ed.design.phase.publish'),
      done: phase3Done,
      active: phase3Active,
    },
  ]

  return (
    <nav
      className={`design-phase-stepper${className ? ` ${className}` : ''}`}
      aria-label={t('ed.design.phase.nav')}
    >
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          {i > 0 ? (
            <span
              className={`design-phase-stepper__connector${step.done || step.active ? ' is-on' : ''}`}
              aria-hidden
            />
          ) : null}
          <span
            className={`design-phase-stepper__step${step.active ? ' is-active' : ''}${step.done ? ' is-done' : ''}`}
          >
            <span className="design-phase-stepper__dot" aria-hidden />
            <span className="design-phase-stepper__label">{step.label}</span>
          </span>
        </React.Fragment>
      ))}
    </nav>
  )
}
