'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { InspectorColorPopover } from '@/components/editor/InspectorColorPopover'
import type { ElementDescriptor, VisualPatch } from '@/lib/visual-edit/protocol'

type ElementInspectorProps = {
  element: ElementDescriptor | null
  onPatch: (patch: VisualPatch) => void
  onSavePatches?: (patches: VisualPatch[]) => void | Promise<void>
  /** Guarda automáticamente tras editar (p. ej. Web Studio). */
  autoPersist?: boolean
  onDiscard?: () => void
  onClose: () => void
  syncStatus?: 'idle' | 'applied' | 'preview-only' | 'draft'
  batchMode?: boolean
  layout?: 'default' | 'studio'
  /** Oculta Cancelar/Guardar del inspector (p. ej. pie del panel Web Studio). */
  hideActionsFooter?: boolean
  saveHandleRef?: React.MutableRefObject<{ save: () => Promise<void> } | null>
  onReimagineElement?: (element: ElementDescriptor) => void
  /** Al cerrar el selector de color nativo (blur), conservar selección en el siguiente clic fuera. */
  onColorPickerBlur?: () => void
  onColorPickerFocus?: () => void
}

type DraftState = {
  text: string
  color: string
  backgroundColor: string
  fontSize: string
  fontWeight: string
  fontStyle: string
  textAlign: string
  padding: string
  margin: string
  borderRadius: string
  borderWidth: string
  borderColor: string
  opacity: string
}

const FONT_WEIGHTS = ['400', '500', '600', '700', '800']
const ALIGN_OPTIONS: { value: string; icon: React.ReactNode; title: string }[] = [
  { value: 'left', title: 'Left', icon: <AlignLeftIcon /> },
  { value: 'center', title: 'Center', icon: <AlignCenterIcon /> },
  { value: 'right', title: 'Right', icon: <AlignRightIcon /> },
  { value: 'justify', title: 'Justify', icon: <AlignJustifyIcon /> },
]

function AlignLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M2 8h8M2 12h10" />
    </svg>
  )
}
function AlignCenterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M4 8h8M3 12h10" />
    </svg>
  )
}
function AlignRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M6 8h8M4 12h10" />
    </svg>
  )
}
function AlignJustifyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  )
}

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`insp2-section__chevron${open ? ' is-open' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function Section({
  title,
  children,
  layout = 'default',
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  layout?: 'default' | 'studio'
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (layout === 'studio') {
    return (
      <div className={`insp2-section insp2-section--studio${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="insp2-section__trigger"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="insp2-section__title">{title}</span>
          <SectionChevron open={open} />
        </button>
        {open ? <div className="insp2-section__content">{children}</div> : null}
      </div>
    )
  }

  return (
    <div className="insp2-section">
      <div className="insp2-section__title">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="insp2-row">
      {label ? <span className="insp2-row__label">{label}</span> : null}
      <div className="insp2-row__control">{children}</div>
    </div>
  )
}

export function ElementInspector({
  element,
  onPatch,
  onSavePatches,
  onDiscard,
  onClose,
  syncStatus = 'idle',
  batchMode = false,
  autoPersist = false,
  layout = 'default',
  hideActionsFooter = false,
  saveHandleRef,
  onReimagineElement,
  onColorPickerBlur,
  onColorPickerFocus,
}: ElementInspectorProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const loadedSkIdRef = useRef<string | null>(null)
  const [draft, setDraft] = useState<DraftState>({
    text: '', color: '', backgroundColor: '', fontSize: '', fontWeight: '',
    fontStyle: '', textAlign: '', padding: '', margin: '', borderRadius: '',
    borderWidth: '', borderColor: '', opacity: '',
  })
  const [baseline, setBaseline] = useState<DraftState>({ ...draft })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!element) {
      loadedSkIdRef.current = null
      const empty: DraftState = {
        text: '', color: '', backgroundColor: '', fontSize: '', fontWeight: '',
        fontStyle: '', textAlign: '', padding: '', margin: '', borderRadius: '',
        borderWidth: '', borderColor: '', opacity: '',
      }
      setDraft(empty)
      setBaseline(empty)
      setDirty(false)
      return
    }
    if (loadedSkIdRef.current === element.skId) return
    loadedSkIdRef.current = element.skId
    const s = element.styles
    const initial: DraftState = {
      text: element.text ?? '',
      color: s.color ?? '',
      backgroundColor: s.backgroundColor ?? '',
      fontSize: s.fontSize?.replace('px', '') ?? '',
      fontWeight: s.fontWeight ?? '',
      fontStyle: s.fontStyle ?? '',
      textAlign: s.textAlign ?? '',
      padding: s.padding ?? '',
      margin: s.margin ?? '',
      borderRadius: s.borderRadius?.replace('px', '') ?? '',
      borderWidth: s.borderWidth?.replace('px', '') ?? '',
      borderColor: s.borderColor ?? '',
      opacity: s.opacity ? String(Math.round(parseFloat(s.opacity) * 100)) : '100',
    }
    setDraft(initial)
    setBaseline(initial)
    setDirty(false)
  }, [element])

  const buildPatchesFromDraft = useCallback((): VisualPatch[] => {
    if (!element) return []
    const skId = element.skId
    const patches: VisualPatch[] = []
    const keys = Object.keys(draft) as (keyof DraftState)[]
    for (const key of keys) {
      if (draft[key] !== baseline[key]) {
        if (key === 'opacity') {
          const num = Math.max(0, Math.min(100, Number(draft[key]) || 0))
          patches.push({ skId, property: 'opacity', value: String((num / 100).toFixed(2)) })
        } else if (key === 'fontSize' || key === 'borderRadius' || key === 'borderWidth') {
          const v = draft[key]
          patches.push({ skId, property: key, value: v ? `${v}px` : '' })
        } else {
          patches.push({ skId, property: key as VisualPatch['property'], value: draft[key] })
        }
      }
    }
    return patches
  }, [element, draft, baseline])

  const handleSave = useCallback(async () => {
    const patches = buildPatchesFromDraft()
    if (onSavePatches && patches.length) await onSavePatches(patches)
    setBaseline({ ...draft })
    setDirty(false)
  }, [buildPatchesFromDraft, draft, onSavePatches])

  useEffect(() => {
    if (!saveHandleRef) return
    saveHandleRef.current = { save: handleSave }
    return () => {
      saveHandleRef.current = null
    }
  }, [saveHandleRef, handleSave])

  if (!element) {
    if (layout === 'studio') return null
    return (
      <div className="inspector-panel inspector-panel--empty">
        {t('ed.inspector.emptyPrefix')}{' '}
        <strong style={{ color: 'var(--text)' }}>{t('ed.editElement')}</strong>{' '}
        {t('ed.inspector.emptySuffix')}
      </div>
    )
  }

  const skId = element.skId

  function patch(property: VisualPatch['property'], rawValue: string) {
    onPatch({ skId, property, value: rawValue })
    let draftValue = rawValue
    if (property === 'fontSize' || property === 'borderRadius' || property === 'borderWidth') {
      draftValue = rawValue.replace(/px$/i, '')
    }
    setDraft((d) => ({ ...d, [property]: draftValue }))
    setDirty(true)
  }

  function patchColor(property: VisualPatch['property'], value: string) {
    patch(property, value)
  }

  function patchOpacity(raw: string) {
    const num = Math.max(0, Math.min(100, Number(raw) || 0))
    const cssVal = String((num / 100).toFixed(2))
    onPatch({ skId, property: 'opacity', value: cssVal })
    setDraft((d) => ({ ...d, opacity: String(num) }))
    setDirty(true)
  }

  function handleDiscard() {
    setDraft({ ...baseline })
    setDirty(false)
    onDiscard?.()
  }

  const tag = element.tagName
  const opacityNum = Number(draft.opacity) || 100

  return (
    <aside className={`inspector-panel insp2${layout === 'studio' ? ' insp2--studio' : ''}`}>
      <div className="inspector-head">
        <div className="inspector-head-main">
          <div className="insp2-tag-row">
            <span className="insp2-tag">{tag}</span>
            {element.skId ? <span className="insp2-skid">{element.skId}</span> : null}
          </div>
        </div>
        <button type="button" className="btn btn-subtle btn-sm" onClick={onClose} aria-label={t('ed.close')}>×</button>
      </div>

      {syncStatus === 'preview-only' && (
        <div className="inspector-notice inspector-notice--warn">{t('ed.previewOnly')}</div>
      )}
      {syncStatus === 'applied' && (
        <div className="inspector-notice inspector-notice--ok">{t('ed.syncApplied')}</div>
      )}
      {(dirty || syncStatus === 'draft') && batchMode && !autoPersist && (
        <div className="inspector-notice">{t('ed.inspector.unsaved')}</div>
      )}

      <div className="insp2-body">
        {element.text !== undefined ? (
          <Section title={t('ed.inspector.text')} layout={layout}>
            <div className="insp2-two-col">
              <label className="insp2-field">
                <span className="insp2-field__label">{t('ed.inspector.fontSize')}</span>
                <input
                  className="insp2-input"
                  type="number"
                  value={draft.fontSize}
                  placeholder="—"
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, fontSize: e.target.value }))
                    setDirty(true)
                    if (batchMode) onPatch({ skId, property: 'fontSize', value: e.target.value ? `${e.target.value}px` : '' })
                  }}
                  onBlur={(e) => { if (!batchMode) patch('fontSize', e.target.value ? `${e.target.value}px` : '') }}
                />
              </label>
              <label className="insp2-field">
                <span className="insp2-field__label">{t('ed.inspector.weight')}</span>
                <select
                  className="insp2-select"
                  value={draft.fontWeight}
                  onChange={(e) => patch('fontWeight', e.target.value)}
                >
                  <option value="">—</option>
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </label>
            </div>
          </Section>
        ) : null}

        <Section title={t('ed.inspector.align')} layout={layout}>
          <div className="insp2-align-group">
            {ALIGN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                className={`insp2-align-btn${draft.textAlign === opt.value ? ' is-active' : ''}`}
                onClick={() => patch('textAlign', opt.value)}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('ed.inspector.layout')} layout={layout}>
          <Row label={t('ed.inspector.margin')}>
            <input
              className="insp2-input"
              type="text"
              value={draft.margin}
              placeholder="0"
              onChange={(e) => {
                setDraft((d) => ({ ...d, margin: e.target.value }))
                setDirty(true)
                if (batchMode) onPatch({ skId, property: 'margin', value: e.target.value })
              }}
              onBlur={(e) => { if (!batchMode) patch('margin', e.target.value) }}
            />
          </Row>
          <Row label={t('ed.inspector.padding')}>
            <input
              className="insp2-input"
              type="text"
              value={draft.padding}
              placeholder="0"
              onChange={(e) => {
                setDraft((d) => ({ ...d, padding: e.target.value }))
                setDirty(true)
                if (batchMode) onPatch({ skId, property: 'padding', value: e.target.value })
              }}
              onBlur={(e) => { if (!batchMode) patch('padding', e.target.value) }}
            />
          </Row>
        </Section>

        <Section title={t('ed.inspector.color')} layout={layout}>
          <InspectorColorPopover
            label={t('ed.inspector.text')}
            value={draft.color}
            onChange={(v) => patchColor('color', v)}
            onOpen={onColorPickerFocus}
            onDismiss={onColorPickerBlur}
          />
          <InspectorColorPopover
            label={t('ed.inspector.background')}
            value={draft.backgroundColor}
            onChange={(v) => patchColor('backgroundColor', v)}
            onOpen={onColorPickerFocus}
            onDismiss={onColorPickerBlur}
          />
        </Section>

        <Section title={t('ed.inspector.opacity')} layout={layout} defaultOpen={false}>
          <div className="insp2-opacity-row">
            <input
              type="range"
              className="insp2-opacity-slider"
              min={0}
              max={100}
              value={opacityNum}
              onChange={(e) => patchOpacity(e.target.value)}
            />
            <div className="insp2-opacity-input-wrap">
              <input
                className="insp2-input insp2-input--narrow"
                type="number"
                min={0}
                max={100}
                value={draft.opacity}
                onChange={(e) => patchOpacity(e.target.value)}
              />
              <span className="insp2-opacity-unit">%</span>
            </div>
          </div>
        </Section>

        <Section title={t('ed.inspector.border')} layout={layout} defaultOpen={false}>
          <InspectorColorPopover
            label={t('ed.inspector.borderColor')}
            value={draft.borderColor}
            onChange={(v) => patchColor('borderColor', v)}
            onOpen={onColorPickerFocus}
            onDismiss={onColorPickerBlur}
          />
          <Row label={t('ed.inspector.borderWidth')}>
            <input
              className="insp2-input"
              type="number"
              value={draft.borderWidth}
              placeholder="0"
              onChange={(e) => {
                setDraft((d) => ({ ...d, borderWidth: e.target.value }))
                setDirty(true)
                if (batchMode) onPatch({ skId, property: 'borderWidth', value: e.target.value ? `${e.target.value}px` : '' })
              }}
              onBlur={(e) => { if (!batchMode) patch('borderWidth', e.target.value ? `${e.target.value}px` : '') }}
            />
          </Row>
          <Row label={t('ed.inspector.radius')}>
            <input
              className="insp2-input"
              type="number"
              value={draft.borderRadius}
              placeholder="0"
              onChange={(e) => {
                setDraft((d) => ({ ...d, borderRadius: e.target.value }))
                setDirty(true)
                if (batchMode) onPatch({ skId, property: 'borderRadius', value: e.target.value ? `${e.target.value}px` : '' })
              }}
              onBlur={(e) => { if (!batchMode) patch('borderRadius', e.target.value ? `${e.target.value}px` : '') }}
            />
          </Row>
        </Section>
      </div>

      {onReimagineElement ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm inspector-variants-btn"
          onClick={() => onReimagineElement(element)}
        >
          {t('ed.design.generateVariants')}
        </button>
      ) : null}

      {batchMode && !hideActionsFooter ? (
        <div className="inspector-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty} onClick={handleDiscard}>
            {t('ed.inspector.cancel')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => void handleSave()}>
            {t('ed.inspector.save')}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
