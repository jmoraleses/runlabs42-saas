'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { formatT } from '@/lib/i18n'
import type {
  DesignClarifyAnswer,
  DesignClarifyQuestion,
} from '@/lib/design/designClarify'

const OTHER_OPTION_ID = '__other__'

type WebStudioClarifyDialogProps = {
  questions: DesignClarifyQuestion[]
  loading?: boolean
  onComplete: (answers: DesignClarifyAnswer[]) => void
  onSkip: () => void
  onCancel: () => void
}

export function WebStudioClarifyDialog({
  questions,
  loading = false,
  onComplete,
  onSkip,
  onCancel,
}: WebStudioClarifyDialogProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, DesignClarifyAnswer>>({})
  const [otherText, setOtherText] = useState('')
  const [otherActive, setOtherActive] = useState(false)

  const total = questions.length
  const current = questions[index]

  useEffect(() => {
    setIndex(0)
    setAnswers({})
    setOtherText('')
    setOtherActive(false)
  }, [questions])

  const currentAnswer = current ? answers[current.id] : undefined
  const selectedIds = useMemo(
    () => new Set(currentAnswer?.selectedOptionIds ?? []),
    [currentAnswer?.selectedOptionIds],
  )

  const resetOtherState = useCallback((answer?: DesignClarifyAnswer) => {
    const hasOther = answer?.selectedOptionIds.includes(OTHER_OPTION_ID)
    setOtherActive(Boolean(hasOther))
    setOtherText(hasOther ? (answer?.otherText ?? '') : '')
  }, [])

  useEffect(() => {
    if (!current) return
    resetOtherState(answers[current.id])
  }, [current, answers, resetOtherState])

  const toggleOption = useCallback(
    (optionId: string) => {
      if (!current) return
      setAnswers((prev) => {
        const existing = prev[current.id]
        const prevIds = existing?.selectedOptionIds ?? []
        let nextIds: string[]
        if (current.allowMultiple) {
          nextIds = prevIds.includes(optionId)
            ? prevIds.filter((id) => id !== optionId)
            : [...prevIds, optionId]
        } else {
          nextIds = [optionId]
        }
        return {
          ...prev,
          [current.id]: {
            questionId: current.id,
            selectedOptionIds: nextIds,
            otherText: existing?.otherText,
          },
        }
      })
      if (optionId === OTHER_OPTION_ID) {
        setOtherActive((v) => !v)
      }
    },
    [current],
  )

  const syncOtherText = useCallback(
    (text: string) => {
      setOtherText(text)
      if (!current) return
      setAnswers((prev) => {
        const existing = prev[current.id]
        const ids = new Set(existing?.selectedOptionIds ?? [])
        if (text.trim()) ids.add(OTHER_OPTION_ID)
        return {
          ...prev,
          [current.id]: {
            questionId: current.id,
            selectedOptionIds: [...ids],
            otherText: text.trim() || undefined,
          },
        }
      })
    },
    [current],
  )

  const canAdvance = useMemo(() => {
    if (!current) return false
    const a = answers[current.id]
    if (!a?.selectedOptionIds.length) return false
    if (a.selectedOptionIds.includes(OTHER_OPTION_ID) && !a.otherText?.trim()) {
      return false
    }
    return true
  }, [current, answers])

  const goNext = useCallback(() => {
    if (!canAdvance) return
    if (index < total - 1) {
      setIndex((i) => i + 1)
      return
    }
    onComplete(questions.map((q) => answers[q.id]).filter(Boolean) as DesignClarifyAnswer[])
  }, [answers, canAdvance, index, onComplete, questions, total])

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1)
  }, [index])

  if (!current) return null

  return (
    <div className="web-studio-clarify-backdrop" role="presentation">
      <div
        className="web-studio-clarify"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-studio-clarify-title"
      >
        <div className="web-studio-clarify__header">
          <p className="web-studio-clarify__badge">{t('ed.design.clarify.badge')}</p>
          <h2 id="web-studio-clarify-title" className="web-studio-clarify__title">
            {t('ed.design.clarify.title')}
          </h2>
          <p className="web-studio-clarify__progress">
            {formatT(t, 'ed.design.clarify.progress', { current: index + 1, total })}
          </p>
        </div>

        <p className="web-studio-clarify__question">{current.question}</p>

        <ul className="web-studio-clarify__options" role="list">
          {current.options.map((opt) => {
            const checked = selectedIds.has(opt.id)
            const inputType = current.allowMultiple ? 'checkbox' : 'radio'
            return (
              <li key={opt.id}>
                <label
                  className={`web-studio-clarify__option${checked ? ' web-studio-clarify__option--checked' : ''}`}
                >
                  <input
                    type={inputType}
                    name={`clarify-${current.id}`}
                    checked={checked}
                    disabled={loading}
                    onChange={() => toggleOption(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            )
          })}
          <li>
            <label
              className={`web-studio-clarify__option${otherActive ? ' web-studio-clarify__option--checked' : ''}`}
            >
              <input
                type={current.allowMultiple ? 'checkbox' : 'radio'}
                name={`clarify-${current.id}`}
                checked={otherActive}
                disabled={loading}
                onChange={() => toggleOption(OTHER_OPTION_ID)}
              />
              <span>{t('ed.design.clarify.other')}</span>
            </label>
            {otherActive ? (
              <input
                type="text"
                className="web-studio-clarify__other-input"
                value={otherText}
                disabled={loading}
                placeholder={t('ed.design.clarify.otherPlaceholder')}
                onChange={(e) => syncOtherText(e.target.value)}
                autoFocus
              />
            ) : null}
          </li>
        </ul>

        <div className="web-studio-clarify__footer">
          <div className="web-studio-clarify__nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={index === 0 || loading}
              aria-label={t('ed.design.clarify.prev')}
              onClick={goPrev}
            >
              ‹
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={index >= total - 1 || loading}
              aria-label={t('ed.design.clarify.next')}
              onClick={() => canAdvance && setIndex((i) => Math.min(i + 1, total - 1))}
            >
              ›
            </button>
          </div>
          <div className="web-studio-clarify__actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading}
              onClick={onCancel}
            >
              {t('ed.cancel')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={loading} onClick={onSkip}>
              {t('ed.design.clarify.skip')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canAdvance || loading}
              onClick={goNext}
            >
              {index < total - 1
                ? t('ed.design.clarify.next')
                : t('ed.design.clarify.generate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
