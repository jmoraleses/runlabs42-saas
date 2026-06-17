'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import {
  DESIGN_BREAKPOINT_PRESETS,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'

const DEVICES: {
  id: DesignPreviewBreakpoint
  Glyph: typeof Icon.Monitor
  labelKey: string
}[] = [
  { id: 'desktop', Glyph: Icon.Monitor, labelKey: 'ed.design.deviceDesktop' },
  { id: 'tablet', Glyph: Icon.Tablet, labelKey: 'ed.design.deviceTablet' },
  { id: 'mobile', Glyph: Icon.Mobile, labelKey: 'ed.design.deviceMobile' },
]

type WebStudioDeviceToggleProps = {
  value: DesignPreviewBreakpoint
  onChange: (device: DesignPreviewBreakpoint) => void
  disabled?: boolean
}

export function WebStudioDeviceToggle({
  value,
  onChange,
  disabled,
}: WebStudioDeviceToggleProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const preset = DESIGN_BREAKPOINT_PRESETS[value]

  return (
    <div
      className="web-studio-device-toggle editor-viewport-group"
      role="group"
      aria-label={t('ed.design.deviceTarget')}
      title={`${t(preset.labelKey)} · ${preset.width}×${preset.height}`}
    >
      {DEVICES.map(({ id, Glyph, labelKey }) => (
        <button
          key={id}
          type="button"
          className={`editor-viewport-btn web-studio-device-toggle__btn${value === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
          disabled={disabled}
          aria-pressed={value === id}
          aria-label={t(labelKey)}
          title={t(labelKey)}
        >
          <Glyph />
        </button>
      ))}
    </div>
  )
}
