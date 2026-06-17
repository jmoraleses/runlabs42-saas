'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'

export type WebStudioFlyoutItem = {
  id: string
  labelKey: string
  soon?: boolean
}

type WebStudioToolFlyoutProps = {
  items: WebStudioFlyoutItem[]
  onSelect?: (id: string) => void
}

const FLYOUT_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  'rect-box': WsIcon.Rect,
  'rect-frame': WsIcon.RectDashed,
  'rect-pen': WsIcon.Pencil,
  'rect-highlighter': WsIcon.Highlighter,
  'image-upload': WsIcon.Image,
  'image-reference': WsIcon.Screenshot,
  'image-generate': WsIcon.Sparkle,
  'star-cmd-image': WsIcon.CommandImage,
  'star-cmd-logo': WsIcon.CommandLogo,
  'star-cmd-diagram': WsIcon.CommandDiagram,
  'star-cmd-animate': WsIcon.CommandPlay,
  'star-cmd-appStore': WsIcon.CommandStore,
  'star-cmd-web': WsIcon.CommandWeb,
  'star-cmd-marketing': WsIcon.CommandMarketing,
  'star-cmd-a11y': WsIcon.CommandA11y,
}

export function WebStudioToolFlyout({ items, onSelect }: WebStudioToolFlyoutProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div className="web-studio-tool-flyout" role="menu">
      <ul className="web-studio-tool-flyout__list">
        {items.map((item) => {
          const Icon = FLYOUT_ICONS[item.id]
          return (
            <li key={item.id}>
              <button
                type="button"
                role="menuitem"
                className={`web-studio-tool-flyout__item${item.soon ? ' is-soon' : ''}`}
                disabled={item.soon}
                onClick={() => !item.soon && onSelect?.(item.id)}
              >
                {Icon ? (
                  <span className="web-studio-tool-flyout__icon" aria-hidden>
                    <Icon size={16} />
                  </span>
                ) : null}
                <span className="web-studio-tool-flyout__label">{t(item.labelKey)}</span>
                {item.soon ? (
                  <span className="web-studio-tool-flyout__badge">{t('ed.webStudio.comingSoon')}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
