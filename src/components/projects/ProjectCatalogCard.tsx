'use client'

import React from 'react'
import { Icon } from '@/components/app/shell'
import type { Project } from '@/types'

type ProjectCatalogCardProps = {
  project: Project
  selected: boolean
  marketplaceListed?: boolean
  marketplaceLabel?: string
  marketplacePriceLabel?: string | null
  marketplaceRatingLabel?: string | null
  createdLabel: string
  createdMetaLabel: string
  liveLabel: string
  detailLabel: string
  openLabel: string
  selectLabel: string
  deselectLabel: string
  zoomLabel?: string
  onToggleSelect: () => void
  onOpen: () => void
  onDetail: () => void
  onZoom?: (url: string) => void
}

export function ProjectCatalogCard({
  project,
  selected,
  marketplaceListed = false,
  marketplaceLabel = '',
  marketplacePriceLabel = null,
  marketplaceRatingLabel = null,
  createdLabel,
  createdMetaLabel,
  liveLabel,
  detailLabel,
  openLabel,
  selectLabel,
  deselectLabel,
  onToggleSelect,
  onOpen,
  onDetail,
  onZoom,
  zoomLabel = 'Zoom',
}: ProjectCatalogCardProps) {
  const isLive = !!project.deployedUrl

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('button, a, input, label'))
  }

  return (
    <li
      className={`ucard projects-catalog-card${selected ? ' ucard--selected' : ''}`}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return
        onToggleSelect()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if (isInteractiveTarget(e.target)) return
        e.preventDefault()
        onToggleSelect()
      }}
      tabIndex={0}
      role="option"
      aria-selected={selected}
    >
      <div className="ucard-thumb">
        <div
          className={`ucard-thumb-inner${
            project.coverUrl
              ? ' ucard-thumb-inner--cover'
              : ' ucard-thumb-inner--placeholder'
          }`}
        >
          {project.coverUrl ? (
            <img
              src={project.coverUrl}
              alt={project.name}
              className="ucard-thumb-cover"
              draggable={false}
            />
          ) : null}
        </div>

        {isLive ? (
          <div className="ucard-badge-tl">
            <span className="pill pill--live" style={{ fontSize: 10 }}>
              <span className="pill-dot" />
              {liveLabel}
            </span>
          </div>
        ) : null}

        <div className="ucard-badge-tr">
          <button
            type="button"
            className="ucard-checkbox"
            aria-pressed={selected}
            aria-label={selected ? deselectLabel : selectLabel}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
          >
            {selected ? <Icon.Check /> : null}
          </button>
        </div>

        <div className="ucard-overlay">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              onDetail()
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {detailLabel}
          </button>
          {onZoom && project.coverUrl && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={zoomLabel}
              onClick={(e) => {
                e.stopPropagation()
                onZoom(project.coverUrl!)
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
              {zoomLabel}
            </button>
          )}
        </div>
      </div>

      <div className="ucard-body">
        <div className="ucard-name-row">
          <div className="ucard-name">{project.name}</div>
          {marketplaceListed ? (
            <span className="ucard-mp-badge">{marketplaceLabel}</span>
          ) : null}
        </div>
        <div className="ucard-meta">
          <span className="ucard-date-line">
            {createdMetaLabel} {createdLabel}
          </span>
        </div>
        {project.description ? (
          <p className="ucard-desc">{project.description}</p>
        ) : null}
        {marketplaceListed && (marketplacePriceLabel || marketplaceRatingLabel) ? (
          <div className="ucard-marketplace-meta">
            {marketplacePriceLabel ? (
              <span className="ucard-marketplace-meta__item">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                {marketplacePriceLabel}
              </span>
            ) : null}
            {marketplaceRatingLabel ? (
              <span className="ucard-marketplace-meta__item">
                <Icon.Star />
                {marketplaceRatingLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ucard-foot-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm ucard-foot-actions__open"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          {openLabel}
        </button>
      </div>
    </li>
  )
}
