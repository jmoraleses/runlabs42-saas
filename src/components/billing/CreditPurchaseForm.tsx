'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { formatT } from '@/lib/i18n'
import {
  CREDIT_PURCHASE_MAX_EUR,
  CREDIT_PURCHASE_MIN_EUR,
  CREDIT_PURCHASE_PRESETS_EUR,
  creditsForEur,
  isPresetAmountEur,
  parsePurchaseAmountEur,
  type CreditPurchasePresetEur,
} from '@/lib/stripe/creditPurchase'

type Selection = CreditPurchasePresetEur | 'custom'

type CreditPurchaseFormProps = {
  initialAmountEur?: number | null
  loading?: boolean
  disabled?: boolean
  onCheckout: (amountEur: number) => void | Promise<void>
}

export function CreditPurchaseForm({
  initialAmountEur,
  loading = false,
  disabled = false,
  onCheckout,
}: CreditPurchaseFormProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const groupId = useId()

  const initialSelection = useMemo((): Selection => {
    if (initialAmountEur != null && isPresetAmountEur(initialAmountEur)) return initialAmountEur
    if (initialAmountEur != null) return 'custom'
    return 15
  }, [initialAmountEur])

  const [selection, setSelection] = useState<Selection>(initialSelection)
  const [customInput, setCustomInput] = useState(
    () => (initialAmountEur != null && !isPresetAmountEur(initialAmountEur) ? String(initialAmountEur) : ''),
  )
  const [fieldError, setFieldError] = useState<string | null>(null)

  function getCustomAmountError(raw: string): string | null {
    const normalized = String(raw).replace(',', '.').trim()
    if (!normalized) {
      return formatT(t, 'credits.purchase.minError', { min: String(CREDIT_PURCHASE_MIN_EUR) })
    }
    const n = Number(normalized)
    if (!Number.isFinite(n)) {
      return formatT(t, 'credits.purchase.minError', { min: String(CREDIT_PURCHASE_MIN_EUR) })
    }
    if (n > CREDIT_PURCHASE_MAX_EUR) {
      return formatT(t, 'credits.purchase.maxError', { max: String(CREDIT_PURCHASE_MAX_EUR) })
    }
    if (n < CREDIT_PURCHASE_MIN_EUR) {
      return formatT(t, 'credits.purchase.minError', { min: String(CREDIT_PURCHASE_MIN_EUR) })
    }
    return null
  }

  // Solo sincronizar desde la URL al montar o cuando cambia el query ?amount=
  const initialAmountKey = initialAmountEur ?? 'default'
  useEffect(() => {
    if (initialAmountEur == null) return
    if (isPresetAmountEur(initialAmountEur)) {
      setSelection(initialAmountEur)
      setCustomInput('')
    } else {
      setSelection('custom')
      setCustomInput(String(initialAmountEur))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar amount en URL
  }, [initialAmountKey])

  const amountEur = useMemo(() => {
    if (selection === 'custom') {
      return parsePurchaseAmountEur(customInput)
    }
    return selection
  }, [selection, customInput])

  const credits = amountEur != null ? creditsForEur(amountEur) : null

  const customAmountError =
    selection === 'custom'
      ? fieldError ?? (customInput ? getCustomAmountError(customInput) : null)
      : null

  function selectPreset(eur: CreditPurchasePresetEur) {
    setSelection(eur)
    setFieldError(null)
  }

  function selectCustom() {
    setSelection('custom')
    setFieldError(null)
  }

  async function handlePay() {
    if (loading) return
    const parsed =
      selection === 'custom' ? parsePurchaseAmountEur(customInput) : selection
    if (parsed == null) {
      const customError =
        selection === 'custom'
          ? getCustomAmountError(customInput)
          : formatT(t, 'credits.purchase.minError', { min: String(CREDIT_PURCHASE_MIN_EUR) })
      setFieldError(customError)
      return
    }
    setFieldError(null)
    await onCheckout(parsed)
  }

  return (
    <div className="settings-card settings-credit-purchase">
      <div className="settings-credit-purchase-header">
        <p className="settings-credit-purchase-lead">{t('credits.purchase.lead')}</p>
        {customAmountError && (
          <p className="settings-credit-purchase-lead-error" role="alert">
            {customAmountError}
          </p>
        )}
      </div>

      <div
        className="settings-credit-purchase-amounts"
        role="radiogroup"
        aria-label={t('credits.purchase.amountLabel')}
      >
        {CREDIT_PURCHASE_PRESETS_EUR.map((eur) => {
          const selected = selection === eur
          const packCredits = creditsForEur(eur)
          const inputId = `${groupId}-preset-${eur}`
          return (
            <label
              key={eur}
              htmlFor={inputId}
              className={`settings-credit-amount${selected ? ' is-selected' : ''}`}
              onClick={() => {
                if (loading) return
                selectPreset(eur)
              }}
            >
              <input
                id={inputId}
                type="radio"
                name={`${groupId}-amount`}
                className="settings-credit-amount-input"
                checked={selected}
                readOnly
                tabIndex={-1}
                aria-hidden
              />
              <span className="settings-credit-amount-check" aria-hidden />
              <span className="settings-credit-amount-eur">{eur} €</span>
              <span className="settings-credit-amount-credits">
                {formatT(t, 'credits.purchase.creditsLine', { credits: String(packCredits) })}
              </span>
            </label>
          )
        })}
        <div className="settings-credit-custom-group">
          <div className="settings-credit-custom-group-body">
            <label
              htmlFor={`${groupId}-custom`}
              className={`settings-credit-amount settings-credit-amount--custom${selection === 'custom' ? ' is-selected' : ''}`}
              onClick={() => {
                if (loading) return
                selectCustom()
              }}
            >
              <input
                id={`${groupId}-custom`}
                type="radio"
                name={`${groupId}-amount`}
                className="settings-credit-amount-input"
                checked={selection === 'custom'}
                readOnly
                tabIndex={-1}
                aria-hidden
              />
              <span className="settings-credit-amount-check" aria-hidden />
              <span className="settings-credit-amount-eur">{t('credits.purchase.other')}</span>
              <span className="settings-credit-amount-credits">{t('credits.purchase.otherHint')}</span>
            </label>

            {selection === 'custom' && (
              <div className="settings-credit-custom">
                <div className="settings-credit-custom-row">
                  <input
                    id={`${groupId}-custom-eur`}
                    type="number"
                    className="input settings-credit-custom-input"
                    min={CREDIT_PURCHASE_MIN_EUR}
                    max={CREDIT_PURCHASE_MAX_EUR}
                    step={1}
                    inputMode="numeric"
                    value={customInput}
                    disabled={loading}
                    aria-label={t('credits.purchase.customLabel')}
                    onChange={(e) => {
                      setCustomInput(e.target.value)
                      setFieldError(null)
                    }}
                  />
                  <span className="settings-credit-custom-suffix">€</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-credit-purchase-summary">
        <div>
          <span className="settings-credit-purchase-summary-label">{t('credits.purchase.total')}</span>
          <strong className="settings-credit-purchase-summary-value">
            {amountEur != null ? `${amountEur} €` : '—'}
          </strong>
        </div>
        <div>
          <span className="settings-credit-purchase-summary-label">{t('credits.purchase.youReceive')}</span>
          <strong className="settings-credit-purchase-summary-value mono">
            {credits != null
              ? formatT(t, 'credits.purchase.creditsLine', { credits: String(credits) })
              : '—'}
          </strong>
        </div>
      </div>

      <div className="settings-credit-purchase-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || loading || amountEur == null}
          title={disabled ? t('credits.purchase.demoBlocked') : undefined}
          onClick={() => void handlePay()}
        >
          {loading ? t('credits.redirecting') : t('credits.purchase.pay')}
        </button>
        <p className="settings-credit-purchase-secure">{t('credits.purchase.secure')}</p>
      </div>
    </div>
  )
}
