'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'

export type GenerationStepStatus = 'done' | 'active' | 'pending'

export type GenerationStep = {
  id: string
  labelKey: string
  status: GenerationStepStatus
  startedAt?: number
  /** Subtítulo opcional (p. ej. modelo activo en Spec-Kit). */
  subtitle?: string
}

type ChatGenerationStepsProps = {
  steps: GenerationStep[]
}

function ElapsedTime({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!startedAt) return
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [startedAt])

  if (!startedAt || elapsed < 1) return null
  return <span className="chat-gen-steps__elapsed">{elapsed}s</span>
}

export function ChatGenerationSteps({ steps }: ChatGenerationStepsProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <ul className="chat-gen-steps" role="status" aria-live="polite">
      {steps.map((step) => (
        <li
          key={step.id}
          className={`chat-gen-steps__item chat-gen-steps__item--${step.status}`}
        >
          <span className="chat-gen-steps__marker" aria-hidden />
          <span className="chat-gen-steps__text">
            {t(step.labelKey)}
            {step.subtitle ? (
              <span className="chat-gen-steps__subtitle"> · {step.subtitle}</span>
            ) : null}
            {step.status === 'active' && (
              <span className="chat-gen-steps__dots" aria-hidden />
            )}
            {step.status === 'active' && <ElapsedTime startedAt={step.startedAt} />}
          </span>
        </li>
      ))}
    </ul>
  )
}
