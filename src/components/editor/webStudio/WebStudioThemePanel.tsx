'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import {
  ensureDesignTokens,
  paletteFromSeed,
  randomElegantSeed,
  readColorMode,
  readSeedColor,
  type ColorMode,
  type PaletteColorKey,
} from '@/lib/design/themeTokens'
import type { DesignTokens } from '@/lib/design/types'

const PALETTE_ROLES: PaletteColorKey[] = ['primary', 'secondary', 'tertiary', 'neutral']

type WebStudioThemePanelProps = {
  projectTitle: string
  tokens?: DesignTokens
  designMd?: string | null
  saving?: boolean
  hasMultiplePages?: boolean
  onClose: () => void
  onSave: (payload: {
    tokens: DesignTokens
    designMd?: string
    scope?: 'page' | 'all'
  }) => void | Promise<void>
}

export function WebStudioThemePanel({
  projectTitle,
  tokens: tokensProp,
  designMd: designMdProp = '',
  saving = false,
  hasMultiplePages = false,
  onClose,
  onSave,
}: WebStudioThemePanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [tab, setTab] = useState<'theme' | 'designMd'>('theme')
  const [colorMode, setColorMode] = useState<ColorMode>(() => readColorMode(tokensProp))
  const [draftTokens, setDraftTokens] = useState<DesignTokens>(() =>
    ensureDesignTokens(tokensProp, readColorMode(tokensProp)),
  )
  const [designMd, setDesignMd] = useState(designMdProp ?? t('ed.webStudio.designMdEmpty'))
  const [editingRole, setEditingRole] = useState<PaletteColorKey | null>(null)

  useEffect(() => {
    const mode = readColorMode(tokensProp)
    setColorMode(mode)
    setDraftTokens(ensureDesignTokens(tokensProp, mode))
  }, [tokensProp])

  useEffect(() => {
    setDesignMd(designMdProp ?? t('ed.webStudio.designMdEmpty'))
  }, [designMdProp, t])

  const colors = draftTokens.colors ?? {}
  const seed = readSeedColor(draftTokens)

  const applySeed = useCallback(
    (hex: string, mode: ColorMode = colorMode) => {
      const next = paletteFromSeed(hex, mode)
      setDraftTokens((prev) =>
        ensureDesignTokens(
          {
            ...prev,
            colorMode: mode,
            colors: { ...prev.colors, ...next, seed: hex },
          },
          mode,
        ),
      )
    },
    [colorMode],
  )

  const setMode = (mode: ColorMode) => {
    setColorMode(mode)
    applySeed(seed, mode)
  }

  const setRoleColor = (role: PaletteColorKey, hex: string) => {
    setDraftTokens((prev) =>
      ensureDesignTokens(
        {
          ...prev,
          colorMode,
          colors: { ...prev.colors, [role]: hex },
        },
        colorMode,
      ),
    )
  }

  const paletteRows = useMemo(
    () =>
      PALETTE_ROLES.map((role) => ({
        role,
        hex: colors[role] ?? '#888888',
        label: t(`ed.webStudio.palette.${role}`),
      })),
    [colors, t],
  )

  return (
    <aside
      className="web-studio-theme-float"
      role="dialog"
      aria-label={t('ed.webStudio.sidePanel')}
    >
      <header className="web-studio-side-panel__head web-studio-theme-float__head">
        <div className="web-studio-side-panel__title-row">
          <button
            type="button"
            className="web-studio-side-panel__back"
            aria-label={t('ed.design.backToCanvas')}
            onClick={onClose}
          >
            <WsIcon.ChevronLeft />
          </button>
          <h2 className="web-studio-side-panel__title">{projectTitle}</h2>
        </div>
        <p className="web-studio-theme-float__subtitle">{t('ed.webStudio.sidePanel')}</p>
      </header>

      <div className="web-studio-side-panel__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'theme'}
          className={`web-studio-side-panel__tab${tab === 'theme' ? ' is-active' : ''}`}
          onClick={() => setTab('theme')}
        >
          {t('ed.webStudio.themeTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'designMd'}
          className={`web-studio-side-panel__tab${tab === 'designMd' ? ' is-active' : ''}`}
          onClick={() => setTab('designMd')}
        >
          DESIGN.md
        </button>
      </div>

      <div className="web-studio-side-panel__body">
        {tab === 'theme' ? (
          <div className="web-studio-theme">
            <div>
              <span className="web-studio-theme__label">{t('ed.webStudio.mode')}</span>
              <div className="web-studio-theme__mode-toggle">
                <button
                  type="button"
                  className={`web-studio-theme__mode${colorMode === 'light' ? ' is-active' : ''}`}
                  onClick={() => setMode('light')}
                >
                  {t('ed.webStudio.light')}
                </button>
                <button
                  type="button"
                  className={`web-studio-theme__mode${colorMode === 'dark' ? ' is-active' : ''}`}
                  onClick={() => setMode('dark')}
                >
                  {t('ed.webStudio.dark')}
                </button>
              </div>
            </div>

            <div>
              <span className="web-studio-theme__label">{t('ed.webStudio.seedColor')}</span>
              <div className="web-studio-theme__seed-row">
                <label className="web-studio-theme__row web-studio-theme__row--grow">
                  <span
                    className="web-studio-theme__swatch"
                    style={{ background: seed }}
                  >
                    <input
                      type="color"
                      className="web-studio-theme__swatch-input"
                      value={seed}
                      onChange={(e) => applySeed(e.target.value)}
                    />
                  </span>
                  <span className="web-studio-theme__hex-text">{seed}</span>
                  <span className="web-studio-theme__chevron" aria-hidden>
                    ›
                  </span>
                </label>
                <button
                  type="button"
                  className="web-studio-theme__shuffle"
                  title={t('ed.webStudio.randomPalette')}
                  onClick={() => applySeed(randomElegantSeed())}
                >
                  ⟳
                </button>
              </div>
            </div>

            <div>
              <span className="web-studio-theme__label">{t('ed.webStudio.colorTheme')}</span>
              <button type="button" className="web-studio-theme__row" disabled>
                <span className="web-studio-theme__gradient" aria-hidden />
                <span>{t('ed.webStudio.custom')}</span>
                <span className="web-studio-theme__chevron" aria-hidden>
                  ›
                </span>
              </button>
            </div>

            <div>
              <span className="web-studio-theme__label">{t('ed.webStudio.colorPalette')}</span>
              <ul className="web-studio-theme__palette">
                {paletteRows.map(({ role, hex, label }) => (
                  <li key={role}>
                    <button
                      type="button"
                      className="web-studio-theme__palette-row"
                      onClick={() =>
                        setEditingRole((cur) => (cur === role ? null : role))
                      }
                    >
                      <span
                        className="web-studio-theme__palette-dot"
                        style={{ background: hex }}
                      />
                      {label}
                    </button>
                    {editingRole === role ? (
                      <div className="web-studio-theme__palette-edit">
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => setRoleColor(role, e.target.value)}
                          aria-label={label}
                        />
                        <span>{hex}</span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="web-studio-theme__label">{t('ed.design.themeFont')}</span>
              <label className="web-studio-theme__row">
                <span className="web-studio-theme__aa" aria-hidden>
                  Aa
                </span>
                <span className="web-studio-theme__font-meta">
                  <span className="web-studio-theme__font-name">
                    {(draftTokens.fonts?.body ?? 'Inter').split(',')[0]?.trim()}
                  </span>
                  <span className="web-studio-theme__font-role">{t('ed.webStudio.headline')}</span>
                </span>
                <input
                  type="text"
                  className="web-studio-theme__font-input"
                  value={draftTokens.fonts?.body?.split(',')[0]?.trim() ?? 'Inter'}
                  onChange={(e) => {
                    const name = e.target.value.trim() || 'Inter'
                    const stack = `${name}, system-ui, sans-serif`
                    setDraftTokens((prev) => ({
                      ...prev,
                      fonts: { body: stack, heading: stack },
                    }))
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="web-studio-design-md">
            <div className="web-studio-design-md__toolbar">
              <span className="web-studio-design-md__file">DESIGN.md</span>
              <button
                type="button"
                className="web-studio-design-md__copy"
                onClick={() => void navigator.clipboard.writeText(designMd)}
              >
                {t('ed.webStudio.copy')}
              </button>
            </div>
            <textarea
              className="web-studio-design-md__editor"
              value={designMd}
              onChange={(e) => setDesignMd(e.target.value)}
              spellCheck={false}
            />
            <p className="web-studio-design-md__hint">{t('ed.webStudio.designMdHint')}</p>
          </div>
        )}
      </div>

      <footer className="web-studio-side-panel__foot web-studio-side-panel__foot--palette">
        {hasMultiplePages ? (
          <>
            <button
              type="button"
              className="web-studio-side-panel__save web-studio-side-panel__save--secondary"
              disabled={saving}
              onClick={() =>
                void onSave({
                  tokens: ensureDesignTokens({ ...draftTokens, colorMode }, colorMode),
                  designMd: tab === 'designMd' ? designMd : undefined,
                  scope: 'page',
                })
              }
            >
              {saving ? '…' : t('ed.webStudio.applyToPage')}
            </button>
            <button
              type="button"
              className="web-studio-side-panel__save"
              disabled={saving}
              onClick={() =>
                void onSave({
                  tokens: ensureDesignTokens({ ...draftTokens, colorMode }, colorMode),
                  designMd: tab === 'designMd' ? designMd : undefined,
                  scope: 'all',
                })
              }
            >
              {saving ? '…' : t('ed.webStudio.applyToAll')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="web-studio-side-panel__save"
            disabled={saving}
            onClick={() =>
              void onSave({
                tokens: ensureDesignTokens({ ...draftTokens, colorMode }, colorMode),
                designMd: tab === 'designMd' ? designMd : undefined,
                scope: 'all',
              })
            }
          >
            {saving ? '…' : t('ed.webStudio.save')}
          </button>
        )}
      </footer>
    </aside>
  )
}
