'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

export type EditorMobilePanel = 'design' | 'preview' | 'chat' | 'files'

type EditorMobilePanelTabsProps = {
  active: EditorMobilePanel
  onChange: (panel: EditorMobilePanel) => void
}

export function EditorMobilePanelTabs({ active, onChange }: EditorMobilePanelTabsProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const tabs: { id: EditorMobilePanel; labelKey: string }[] = [
    { id: 'design', labelKey: 'ed.design.viewTab' },
    { id: 'preview', labelKey: 'ed.mobileTab.preview' },
    { id: 'chat', labelKey: 'ed.mobileTab.chat' },
    { id: 'files', labelKey: 'ed.mobileTab.files' },
  ]

  return (
    <div className="editor-mobile-panel-tabs" role="tablist" aria-label={t('ed.mobileTab.label')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`editor-mobile-panel-tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}
