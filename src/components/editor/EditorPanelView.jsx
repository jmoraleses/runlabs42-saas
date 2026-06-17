'use client'

import React from 'react'
import { CodeEditor } from '@/components/editor/CodeEditor'

export function EditorPanelView({ fileTree, filesLoading, code, onCodeChange, t }) {
  return (
    <div className="editor-panel-view">
      <aside className="editor-panel-files no-scrollbar">
        <span className="editor-rail-label">{t('ed.files')}</span>
        {filesLoading ? (
          <p className="editor-rail-empty">{t('ed.loading')}</p>
        ) : (
          fileTree
        )}
      </aside>
      <div className="editor-panel-code">
        <div className="editor-code-pane-head mono">{activePath}</div>
        <CodeEditor path={activePath} value={code} onChange={onCodeChange} language="typescript" />
      </div>
    </div>
  )
}
