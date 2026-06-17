'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/components/app/shell'
import {
  defaultPickerRgb,
  formatInspectorColor,
  hsvToRgb,
  inspectorColorCss,
  isTransparentColor,
  rgbToHsv,
  type Hsv,
  type Rgb,
} from '@/lib/color/inspectorColor'

type EyeDropperLike = {
  open: () => Promise<{ sRGBHex: string }>
}

type WindowWithEyeDropper = Window & {
  EyeDropper?: new () => EyeDropperLike
}

type InspectorColorPopoverProps = {
  value: string
  label: string
  onChange: (value: string) => void
  onOpen?: () => void
  onDismiss?: () => void
}

function rgbFields(rgb: Rgb): { r: string; g: string; b: string } {
  return { r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) }
}

function hexToRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const raw = m[1]
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

export function InspectorColorPopover({
  value,
  label,
  onChange,
  onOpen,
  onDismiss,
}: InspectorColorPopoverProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const swatchRef = useRef<HTMLButtonElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const [transparent, setTransparent] = useState(() => isTransparentColor(value))
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(defaultPickerRgb(value)))
  const [rgbDraft, setRgbDraft] = useState(() => rgbFields(defaultPickerRgb(value)))
  const [isPickingScreen, setIsPickingScreen] = useState(false)

  const canUseEyeDropper = typeof window !== 'undefined' && Boolean((window as WindowWithEyeDropper).EyeDropper)
  const eyeDropperTitle = canUseEyeDropper ? t('ed.inspector.colorPickScreen') : t('ed.inspector.colorPickScreenUnsupported')

  const previewCss = transparent ? 'transparent' : formatInspectorColor(hsvToRgb(hsv))
  const displayValue = transparent ? 'transparent' : previewCss

  const close = useCallback(
    (dismiss = true) => {
      setOpen(false)
      if (dismiss) onDismiss?.()
    },
    [onDismiss],
  )

  const openPicker = useCallback(() => {
    const isT = isTransparentColor(value)
    const rgb = defaultPickerRgb(value)
    setTransparent(isT)
    setHsv(rgbToHsv(rgb))
    setRgbDraft(rgbFields(rgb))
    setOpen(true)
    onOpen?.()
  }, [value, onOpen])

  const applyHsv = useCallback((next: Hsv) => {
    setTransparent(false)
    setHsv(next)
    const rgb = hsvToRgb(next)
    setRgbDraft(rgbFields(rgb))
  }, [])

  const applyRgb = useCallback((rgb: Rgb) => {
    setTransparent(false)
    setHsv(rgbToHsv(rgb))
    setRgbDraft(rgbFields(rgb))
  }, [])

  const handleAccept = useCallback(() => {
    onChange(transparent ? 'transparent' : formatInspectorColor(hsvToRgb(hsv)))
    setOpen(false)
  }, [transparent, hsv, onChange])

  const handleCancel = useCallback(() => {
    close(true)
  }, [close])

  const handlePickFromScreen = useCallback(async () => {
    const EyeDropperCtor = (window as WindowWithEyeDropper).EyeDropper
    if (!EyeDropperCtor || isPickingScreen) return
    try {
      setIsPickingScreen(true)
      const picker = new EyeDropperCtor()
      const { sRGBHex } = await picker.open()
      const rgb = hexToRgb(sRGBHex)
      if (!rgb) return
      applyRgb(rgb)
    } catch {
      // Usuario canceló el cuentagotas o navegador bloqueó la captura.
    } finally {
      setIsPickingScreen(false)
    }
  }, [applyRgb, isPickingScreen])

  useLayoutEffect(() => {
    if (!open || !swatchRef.current) return
    const r = swatchRef.current.getBoundingClientRect()
    const width = 248
    // Estimación para evitar que el popover quede recortado al añadir más controles.
    const height = 380
    let left = r.left
    let top = r.bottom + 8
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12)
    }
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, r.top - height - 8)
    }
    setPopoverPos({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.insp2-color-popover')) return
      close(true)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(true)
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  function onSvPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (transparent) setTransparent(false)
    const move = (ev: PointerEvent) => {
      const el = svRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height))
      applyHsv({ h: hsv.h, s: x, v: 1 - y })
    }
    move(e.nativeEvent)
    const onUp = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  function onRgbField(channel: 'r' | 'g' | 'b', raw: string) {
    const next = { ...rgbDraft, [channel]: raw }
    setRgbDraft(next)
    const r = Number(next.r)
    const g = Number(next.g)
    const b = Number(next.b)
    if ([r, g, b].some((n) => Number.isNaN(n))) return
    applyRgb({ r, g, b })
  }

  return (
    <div className="insp2-color-row" ref={rootRef}>
      <button
        ref={swatchRef}
        type="button"
        className="insp2-color-swatch-wrap"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        onClick={() => (open ? close(false) : openPicker())}
      >
        <span
          className="insp2-color-swatch"
          style={{ background: open ? previewCss : inspectorColorCss(value) }}
          data-transparent={transparent || isTransparentColor(value) || undefined}
        />
      </button>
      <span id={titleId} className="insp2-color-row__label">
        {label}
      </span>
      <span className="insp2-color-row__value mono">{displayValue}</span>

      {open
        ? createPortal(
            <div
              className="insp2-color-popover insp2-color-popover--floating"
              role="dialog"
              aria-labelledby={titleId}
              style={{ top: popoverPos.top, left: popoverPos.left }}
              onPointerDown={(e) => e.stopPropagation()}
            >
          <div
            ref={svRef}
            className="insp2-color-popover__sv"
            style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            onPointerDown={onSvPointerDown}
          >
            <div className="insp2-color-popover__sv-layer insp2-color-popover__sv-layer--white" />
            <div className="insp2-color-popover__sv-layer insp2-color-popover__sv-layer--black" />
            <span
              className="insp2-color-popover__sv-thumb"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                opacity: transparent ? 0.35 : 1,
              }}
            />
          </div>

          <div className="insp2-color-popover__sliders">
            <span
              className="insp2-color-popover__preview"
              style={{ background: previewCss }}
              data-transparent={transparent || undefined}
            />
            <input
              type="range"
              className="insp2-color-popover__hue"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              disabled={transparent}
              onChange={(e) => applyHsv({ ...hsv, h: Number(e.target.value) })}
              aria-label={label}
            />
          </div>

          <div className="insp2-color-popover__rgb">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <label key={ch} className="insp2-color-popover__rgb-field">
                <span className="insp2-color-popover__rgb-label">{ch.toUpperCase()}</span>
                <input
                  className="insp2-input insp2-color-popover__rgb-input"
                  type="number"
                  min={0}
                  max={255}
                  value={rgbDraft[ch]}
                  disabled={transparent}
                  onChange={(e) => onRgbField(ch, e.target.value)}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            className={`insp2-color-popover__transparent${transparent ? ' is-active' : ''}`}
            onClick={() => setTransparent((t) => !t)}
          >
            {t('ed.inspector.colorTransparent')}
          </button>

          <button
            type="button"
            className={`insp2-color-popover__eyedropper${isPickingScreen ? ' is-active' : ''}`}
            onClick={() => void handlePickFromScreen()}
            disabled={!canUseEyeDropper || isPickingScreen}
            title={eyeDropperTitle}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.6 2.2l3.2 3.2-1.6 1.6L9 3.8z" />
              <path d="M8.4 4.4L2 10.8V14h3.2l6.4-6.4" />
              <path d="M6.2 9.4l.4 2.4" />
            </svg>
            <span>{t('ed.inspector.colorPickScreen')}</span>
          </button>

          <div className="insp2-color-popover__actions">
            <button type="button" className="insp2-color-popover__btn insp2-color-popover__btn--ghost" onClick={handleCancel}>
              {t('ed.pinCancelSpot')}
            </button>
            <button type="button" className="insp2-color-popover__btn insp2-color-popover__btn--primary" onClick={handleAccept}>
              {t('ed.inspector.colorAccept')}
            </button>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
