'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

export type AgentActivityPhase = 'design' | 'code'

export type DesignAgentLogEntry = {
  id: string
  message: string
  status?: 'pending' | 'done' | 'error'
}

export type DesignAgentPhaseBlock = {
  phase: AgentActivityPhase
  steps: DesignAgentLogEntry[]
}

type DesignAgentLogProps = {
  phases: DesignAgentPhaseBlock[]
  building?: boolean
  compact?: boolean
  variant?: 'default' | 'studio'
}

function phaseLabel(t: (key: string) => string, phase: AgentActivityPhase): string {
  return phase === 'code' ? t('ed.design.phaseCode') : t('ed.design.phaseDesign')
}

function resolvePhaseStatus(block: DesignAgentPhaseBlock, building: boolean) {
  const pending = block.steps.find((s) => s.status === 'pending')
  const error = block.steps.find((s) => s.status === 'error')
  const lastDone = [...block.steps].reverse().find((s) => s.status === 'done')
  const isActive = Boolean(pending) || (building && !lastDone && !error)
  return { pending, error, isActive }
}

export function DesignAgentLog({
  phases,
  building,
  compact,
  variant = 'default',
}: DesignAgentLogProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const visiblePhases = phases.filter((p) => p.steps.length > 0)
  const hasSteps = visiblePhases.length > 0
  if (!hasSteps && !building) return null

  const studio = variant === 'studio'
  const showBuildingFallback = Boolean(
    building && !phases.some((p) => p.steps.some((s) => s.status === 'pending')),
  )

  return (
    <div
      className={`design-agent-log${compact ? ' design-agent-log--compact' : ''}${studio ? ' design-agent-log--studio' : ''}`}
      aria-live="polite"
    >
      {!compact && !studio ? (
        <p className="design-agent-log__title">{t('ed.design.agentLog')}</p>
      ) : null}
      <div className="design-agent-log__phases">
        {visiblePhases.map((block) => {
          const { pending, error, isActive } = resolvePhaseStatus(block, building ?? false)

          if (studio) {
            return (
              <section
                key={block.phase}
                className={`design-agent-phase${isActive ? ' is-active' : ''}${error ? ' has-error' : ''}`}
                aria-label={phaseLabel(t, block.phase)}
              >
                <div className="design-agent-phase__head">
                  <span className="design-agent-phase__title">{phaseLabel(t, block.phase)}</span>
                  {error ? (
                    <span className="design-agent-phase__mark design-agent-phase__mark--error" aria-hidden>
                      ×
                    </span>
                  ) : pending ? null : isActive ? (
                    <span className="design-agent-log__spinner design-agent-phase__spinner" aria-hidden />
                  ) : (
                    <span className="design-agent-phase__mark design-agent-phase__mark--done" aria-hidden>
                      ✓
                    </span>
                  )}
                </div>
                <ol className="design-agent-phase__timeline">
                  {block.steps.map((step) => (
                    <li
                      key={step.id}
                      className={`design-agent-phase__step design-agent-phase__step--${step.status ?? 'done'}`}
                    >
                      {step.status === 'pending' ? (
                        <span className="design-agent-log__spinner design-agent-phase__step-spinner" aria-hidden />
                      ) : (
                        <span className="design-agent-phase__step-dot" aria-hidden />
                      )}
                      <span className="design-agent-phase__step-text">{step.message}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )
          }

          const message =
            pending?.message ??
            error?.message ??
            [...block.steps].reverse().find((s) => s.status === 'done')?.message ??
            (isActive ? t('ed.design.building') : t('ed.design.phaseDone'))

          return (
            <section
              key={block.phase}
              className={`design-agent-phase${isActive ? ' is-active' : ''}${error ? ' has-error' : ''}`}
              aria-label={phaseLabel(t, block.phase)}
            >
              <div className="design-agent-phase__head">
                <span className="design-agent-phase__title">{phaseLabel(t, block.phase)}</span>
                {isActive && !error ? (
                  <span className="design-agent-log__spinner design-agent-phase__spinner" aria-hidden />
                ) : error ? (
                  <span className="design-agent-phase__mark design-agent-phase__mark--error" aria-hidden>
                    ×
                  </span>
                ) : (
                  <span className="design-agent-phase__mark design-agent-phase__mark--done" aria-hidden>
                    ✓
                  </span>
                )}
              </div>
              <p
                className={`design-agent-phase__status${pending ? ' is-pending' : ''}${error ? ' is-error' : ''}`}
              >
                {message}
              </p>
            </section>
          )
        })}
        {showBuildingFallback ? (
          <section className="design-agent-phase is-active">
            <div className="design-agent-phase__head">
              <span className="design-agent-phase__title">{t('ed.design.phaseDesign')}</span>
              <span className="design-agent-log__spinner design-agent-phase__spinner" aria-hidden />
            </div>
            <p className="design-agent-phase__status is-pending">{t('ed.design.building')}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
