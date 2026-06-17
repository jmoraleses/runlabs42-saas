'use client'

import React, { useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { ElementInspector } from '@/components/editor/ElementInspector'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import type { ElementDescriptor, VisualPatch } from '@/lib/visual-edit/protocol'

type WebStudioElementPanelProps = {
  projectTitle: string
  element: ElementDescriptor | null
  syncStatus?: 'idle' | 'applied' | 'preview-only' | 'draft'
  onClose: () => void
  onPatch: (patch: VisualPatch) => void
  onSavePatches: (patches: VisualPatch[]) => void | Promise<void>
  onDiscard: () => void
  onClearSelection: () => void
  onEditText?: () => void
  onReplaceImage?: () => void
  onDelete?: () => void
  onColorPickerBlur?: () => void
  onColorPickerFocus?: () => void
}

function PropertiesEmptyState() {
  const { t } = useApp() as { t: (key: string) => string }
  return (
    <div className="web-studio-prop-empty">
      <div className="web-studio-prop-empty__glyph" aria-hidden>
        <WsIcon.Gear size={28} />
      </div>
      <p className="web-studio-prop-empty__copy">
        <span className="web-studio-prop-empty__line">{t('ed.inspector.emptyPrefix')}</span>
        <span className="web-studio-prop-empty__emphasis">{t('ed.webStudio.toolProperties')}</span>
        <span className="web-studio-prop-empty__line">{t('ed.inspector.emptySuffix')}</span>
      </p>
    </div>
  )
}

export function WebStudioElementPanel({
  projectTitle,
  element,
  syncStatus = 'idle',
  onClose,
  onPatch,
  onSavePatches,
  onDiscard,
  onClearSelection,
  onEditText,
  onReplaceImage,
  onDelete,
  onColorPickerBlur,
  onColorPickerFocus,
}: WebStudioElementPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const inspectorSaveRef = useRef<{ save: () => Promise<void> } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSaveClick = async () => {
    if (!inspectorSaveRef.current) return
    setSaving(true)
    try {
      await inspectorSaveRef.current.save()
    } finally {
      setSaving(false)
    }
  }

  const subtitle = element
    ? `${element.tagName}${element.skId ? ` · ${element.skId}` : ''}`
    : t('ed.webStudio.selectElementHint')
  const isImageElement = element?.tagName.toLowerCase() === 'img'

  return (
    <aside
      className="web-studio-side-panel web-studio-element-panel"
      aria-label={t('ed.webStudio.propertiesPanel')}
    >
      <header className="web-studio-element-panel__head">
        <button
          type="button"
          className="web-studio-element-panel__collapse"
          aria-label={t('ed.design.backToCanvas')}
          onClick={() => {
            onDiscard()
            onClose()
          }}
        >
          <WsIcon.ChevronLeft />
        </button>
        <div className="web-studio-element-panel__meta">
          <p className="web-studio-element-panel__eyebrow">{t('ed.webStudio.propertiesPanel')}</p>
          <h2 className="web-studio-element-panel__title">{projectTitle}</h2>
          <p
            className={`web-studio-element-panel__hint${element ? ' web-studio-element-panel__hint--mono' : ''}`}
          >
            {subtitle}
          </p>
        </div>
      </header>

      <div className="web-studio-element-panel__nav" role="tablist">
        <span role="tab" aria-selected className="web-studio-element-panel__nav-tab is-active">
          {t('ed.webStudio.propertiesTab')}
        </span>
      </div>

      {element && (onEditText || onReplaceImage || onDelete) ? (
        <div className="web-studio-element-panel__actions" role="group" aria-label={t('ed.editElement')}>
          {isImageElement && onReplaceImage ? (
            <button type="button" className="web-studio-element-panel__action" onClick={onReplaceImage}>
              <span className="web-studio-element-panel__action-icon" aria-hidden>
                <WsIcon.Image size={18} />
              </span>
              {t('ed.replaceImage')}
            </button>
          ) : null}
          {!isImageElement && onEditText ? (
            <button type="button" className="web-studio-element-panel__action" onClick={onEditText}>
              <span className="web-studio-element-panel__action-icon" aria-hidden>
                <WsIcon.TypeCursor size={18} />
              </span>
              {t('ed.editText')}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="web-studio-element-panel__action web-studio-element-panel__action--danger"
              onClick={onDelete}
            >
              <span className="web-studio-element-panel__action-icon" aria-hidden>
                <WsIcon.Trash size={18} />
              </span>
              {t('ed.delete')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="web-studio-element-panel__body">
        {element ? (
          <ElementInspector
            layout="studio"
            element={element}
            batchMode
            hideActionsFooter
            saveHandleRef={inspectorSaveRef}
            syncStatus={syncStatus}
            onPatch={onPatch}
            onSavePatches={onSavePatches}
            onDiscard={onDiscard}
            onClose={onClearSelection}
            onColorPickerBlur={onColorPickerBlur}
            onColorPickerFocus={onColorPickerFocus}
          />
        ) : (
          <PropertiesEmptyState />
        )}
      </div>

      {element ? (
        <footer className="web-studio-side-panel__foot web-studio-element-panel__foot">
          <button
            type="button"
            className="web-studio-side-panel__save web-studio-element-panel__save"
            disabled={saving}
            onClick={() => void handleSaveClick()}
          >
            {saving ? '…' : t('ed.webStudio.save')}
          </button>
        </footer>
      ) : null}
    </aside>
  )
}
