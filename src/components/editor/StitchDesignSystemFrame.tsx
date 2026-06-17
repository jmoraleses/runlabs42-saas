'use client'

import React, { useMemo } from 'react'
import { useApp } from '@/components/app/shell'
import { ensureDesignTokens } from '@/lib/design/themeTokens'
import type { DesignTokens } from '@/lib/design/types'
import type { DesignPageMeta } from '@/lib/design/types'
import {
  DESIGN_SYSTEM_FRAME_HEIGHT,
  DESIGN_SYSTEM_FRAME_WIDTH,
} from '@/lib/design/prototypePages'
import {
  visualLanguageBrandSwatches,
  visualLanguageUiColors,
} from '@/lib/design/visualLanguagePalette'

type StitchDesignSystemFrameProps = {
  page: DesignPageMeta
  tokens?: DesignTokens
  selected?: boolean
  onSelect?: () => void
  moveMode?: boolean
  onMovePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
}

function firstFontName(stack?: string): string {
  if (!stack) return 'system-ui'
  return stack.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || 'system-ui'
}

function googleFontsHref(...stacks: (string | undefined)[]): string | null {
  const names = new Set<string>()
  for (const stack of stacks) {
    const name = firstFontName(stack)
    if (name && !/system-ui|sans-serif|serif|monospace/i.test(name)) {
      names.add(name.replace(/\s+/g, '+'))
    }
  }
  if (!names.size) return null
  const families = [...names]
    .map((n) => `family=${n}:wght@400;500;600;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function WandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 4l5 5M4 20l8-8 3 3-8 8-3-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShapesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 20h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12V5a1 1 0 011-1h7l9 9-7 7-9-9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StitchDesignSystemFrame({
  page,
  tokens: rawTokens,
  selected,
  onSelect,
  moveMode = false,
  onMovePointerDown,
  onMovePointerMove,
  onMovePointerUp,
}: StitchDesignSystemFrameProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const w = page.width ?? DESIGN_SYSTEM_FRAME_WIDTH
  const h = page.height ?? DESIGN_SYSTEM_FRAME_HEIGHT
  const tokens = useMemo(() => ensureDesignTokens(rawTokens), [rawTokens])
  const colors = tokens.colors ?? {}
  const ui = useMemo(() => visualLanguageUiColors(colors), [colors])
  const brandSwatches = useMemo(() => visualLanguageBrandSwatches(colors), [colors])

  const headingFont = tokens.fonts?.heading ?? 'system-ui, sans-serif'
  const bodyFont = tokens.fonts?.body ?? headingFont
  const labelFont = tokens.fonts?.label ?? bodyFont
  const headingName = firstFontName(headingFont)
  const bodyName = firstFontName(bodyFont)
  const labelName = firstFontName(labelFont)
  const radius = tokens.radius ?? '12px'
  const fontsHref = googleFontsHref(headingFont, bodyFont, labelFont)

  const panelBg = ui.surface
  const panelBorder = ui.outline

  return (
    <div
      className={`stitch-ds-frame${selected ? ' is-selected' : ''}${moveMode ? ' design-page-frame--move' : ''}`}
      style={{ left: page.x ?? 0, top: page.y ?? 0, width: w, height: h + 32 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onPointerDown={onMovePointerDown}
      onPointerMove={onMovePointerMove}
      onPointerUp={onMovePointerUp}
      onPointerCancel={onMovePointerUp}
    >
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <div className="stitch-ds-frame__chrome">
        <span>{page.name}</span>
      </div>
      <div
        className="stitch-ds-frame__body stitch-ds-frame__body--visual-lang stitch-ds-frame__body--board"
        style={{ background: ui.canvasBg, color: ui.onSurface }}
      >
        <div className="stitch-ds-frame__board">
          <section
            className="stitch-ds-frame__panel stitch-ds-frame__panel--colors"
            style={{ background: panelBg, borderColor: panelBorder, borderRadius: radius }}
            aria-label={t('ed.design.paletteBrand')}
          >
            {brandSwatches.map(({ role, hex, scale }) => (
              <div key={role} className="stitch-ds-frame__palette-row">
                <span className="stitch-ds-frame__palette-role">
                  {t(`ed.webStudio.palette.${role}`)}
                </span>
                <div
                  className="stitch-ds-frame__swatch stitch-ds-frame__swatch--hero"
                  style={{ background: hex, borderRadius: radius }}
                  title={`${role}: ${hex}`}
                />
                <code className="stitch-ds-frame__hex">{hex}</code>
                <div className="stitch-ds-frame__scale" aria-hidden>
                  {scale.map((tone, i) => (
                    <span
                      key={`${role}-${i}`}
                      className="stitch-ds-frame__scale-step"
                      style={{ background: tone }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section
            className="stitch-ds-frame__panel stitch-ds-frame__panel--type"
            style={{ background: panelBg, borderColor: panelBorder, borderRadius: radius }}
            aria-label="Typography"
          >
            <div className="stitch-ds-frame__type-block">
              <span
                className="stitch-ds-frame__aa stitch-ds-frame__aa--headline"
                style={{ fontFamily: headingFont }}
              >
                Aa
              </span>
              <span className="stitch-ds-frame__font" style={{ fontFamily: headingFont }}>
                {headingName}
              </span>
              <span className="stitch-ds-frame__font-role">{t('ed.webStudio.headline')}</span>
            </div>
            <div className="stitch-ds-frame__type-block">
              <span
                className="stitch-ds-frame__aa stitch-ds-frame__aa--body"
                style={{ fontFamily: bodyFont }}
              >
                Aa
              </span>
              <span className="stitch-ds-frame__font" style={{ fontFamily: bodyFont }}>
                {bodyName}
              </span>
              <span className="stitch-ds-frame__font-role">Body</span>
            </div>
            <div className="stitch-ds-frame__type-block">
              <span
                className="stitch-ds-frame__aa stitch-ds-frame__aa--label"
                style={{ fontFamily: labelFont }}
              >
                Aa
              </span>
              <span className="stitch-ds-frame__font" style={{ fontFamily: labelFont }}>
                {labelName}
              </span>
              <span className="stitch-ds-frame__font-role">Label</span>
            </div>
          </section>

          <section
            className="stitch-ds-frame__panel stitch-ds-frame__panel--ui"
            style={{ background: panelBg, borderColor: panelBorder, borderRadius: radius }}
          >
            <div className="stitch-ds-frame__buttons">
              <span
                className="stitch-ds-frame__btn stitch-ds-frame__btn--primary"
                style={{
                  background: ui.primaryBtn,
                  color: ui.onPrimaryBtn,
                  borderRadius: radius,
                }}
              >
                {t('ed.webStudio.palette.primary')}
              </span>
              <span
                className="stitch-ds-frame__btn stitch-ds-frame__btn--secondary"
                style={{
                  background: ui.secondaryBtn,
                  color: ui.onSurface,
                  borderRadius: radius,
                }}
              >
                {t('ed.webStudio.palette.secondary')}
              </span>
              <span
                className="stitch-ds-frame__btn stitch-ds-frame__btn--inverted"
                style={{
                  background: ui.invertedBg,
                  color: ui.invertedFg,
                  borderRadius: radius,
                }}
              >
                Inverted
              </span>
              <span
                className="stitch-ds-frame__btn stitch-ds-frame__btn--outline"
                style={{
                  borderColor: ui.outline,
                  color: ui.onSurface,
                  borderRadius: radius,
                }}
              >
                Outline
              </span>
            </div>

            <label
              className="stitch-ds-frame__search"
              style={{
                background: ui.canvasBg,
                borderColor: ui.outline,
                borderRadius: radius,
                color: ui.onSurface,
              }}
            >
              <SearchIcon />
              <span>Search</span>
            </label>

            <nav
              className="stitch-ds-frame__nav-pill"
              style={{
                background: ui.canvasBg,
                borderRadius: '999px',
                border: `1px solid ${ui.outline}`,
              }}
              aria-label="Navigation preview"
            >
              <span
                className="stitch-ds-frame__nav-item is-active"
                style={{ background: ui.primaryBtn, color: ui.onPrimaryBtn }}
              >
                <HomeIcon />
              </span>
              <span className="stitch-ds-frame__nav-item" style={{ color: ui.onSurface }}>
                <SearchIcon />
              </span>
              <span className="stitch-ds-frame__nav-item" style={{ color: ui.onSurface }}>
                <UserIcon />
              </span>
            </nav>

            <div className="stitch-ds-frame__accent-bars" aria-hidden>
              <span style={{ background: ui.iconPrimary }} />
              <span style={{ background: ui.iconSecondary }} />
              <span style={{ background: ui.iconTertiary }} />
            </div>
          </section>

          <section
            className="stitch-ds-frame__panel stitch-ds-frame__panel--icons"
            style={{ background: panelBg, borderColor: panelBorder, borderRadius: radius }}
          >
            <div className="stitch-ds-frame__icon-row">
              {[
                { bg: ui.iconPrimary, icon: <WandIcon /> },
                { bg: ui.iconSecondary, icon: <ShapesIcon /> },
                { bg: ui.iconTertiary, icon: <TagIcon /> },
                { bg: ui.error, icon: <TrashIcon /> },
              ].map((item, i) => (
                <span
                  key={i}
                  className="stitch-ds-frame__icon-btn"
                  style={{
                    background: item.bg,
                    color: ui.onPrimaryBtn,
                    borderRadius: '999px',
                  }}
                >
                  {item.icon}
                </span>
              ))}
            </div>

            <span
              className="stitch-ds-frame__labeled-btn"
              style={{
                background: ui.primaryBtn,
                color: ui.onPrimaryBtn,
                borderRadius: radius,
              }}
            >
              <PencilIcon />
              Label
            </span>

            <span
              className="stitch-ds-frame__icon-btn stitch-ds-frame__icon-btn--square"
              style={{
                background: ui.iconNeutral,
                color: ui.onPrimaryBtn,
                borderRadius: radius,
              }}
            >
              <PencilIcon />
            </span>

            <div className="stitch-ds-frame__accent-bars stitch-ds-frame__accent-bars--wide" aria-hidden>
              <span style={{ background: ui.iconPrimary, width: '72%' }} />
              <span style={{ background: ui.iconSecondary, width: '48%' }} />
              <span style={{ background: ui.iconTertiary, width: '36%' }} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
