'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CHAT_MODEL_CATEGORY_ORDER,
  groupOptionsByChatCategory,
  type ChatModelCategory,
} from '@/lib/ai/chatModelCategories'
import { Icon, useApp } from '@/components/app/shell'
import { ComposerToolButton } from '@/components/chat/ComposerToolButton'
import { useCloseOnClickOutside } from '@/hooks/useCloseOnClickOutside'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/models'
import type { AIModelSelectOption } from '@/components/editor/AIModelSelect'
import type { ImageModelOption } from '@/hooks/useImageModel'
import {
  EMPTY_CATEGORY_CHOICES,
  type CategoryModelChoices,
  type ChatModelSelectionMode,
} from '@/lib/ai/chatModelChoices'

type ChatModelMenuProps = {
  value: string
  options: AIModelSelectOption[]
  onChange: (modelId: string) => void
  categoryChoices?: CategoryModelChoices
  selectionMode?: ChatModelSelectionMode
  onCategoryModelChange?: (category: ChatModelCategory, modelId: string) => void
  imageModelValue?: string
  imageModelOptions?: ImageModelOption[]
  generateImages?: boolean
  onGenerateImagesChange?: (enabled: boolean) => void
  onImageModelChange?: (modelId: string) => void
  imageGenerationDisabled?: boolean
  disabled?: boolean
  /** `pill`: muestra nombre del modelo + chevron (barra Web Studio). */
  triggerVariant?: 'icon' | 'pill'
  /** Estado controlado del desplegable (p. ej. barra Web Studio). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function resolveModelLabel(
  value: string,
  options: AIModelSelectOption[],
  t: (key: string) => string,
): string {
  if (value === AUTO_MODEL_ID) return t('chat.modelMenu.autoTitle')
  if (value === MAX_MODEL_ID) return t('chat.modelMenu.maxTitle')
  return options.find((o) => o.id === value)?.label ?? value
}

function ModelPriceMeta({
  opt,
  t,
}: {
  opt: AIModelSelectOption
  t: (key: string) => string
}) {
  if (!opt.enabled) {
    return <span className="composer-model-meta composer-model-meta--soon">{t('ed.modelSoon')}</span>
  }

  if (opt.priceIn && opt.priceOut) {
    return (
      <span className="composer-model-meta">
        <span className="composer-model-price">
          <span className="composer-model-price__pair">
            <span className="composer-model-price__label">{t('ed.priceInShort')}</span>
            <span className="composer-model-price__value">{opt.priceIn}</span>
          </span>
          <span className="composer-model-price__sep" aria-hidden />
          <span className="composer-model-price__pair">
            <span className="composer-model-price__label">{t('ed.priceOutShort')}</span>
            <span className="composer-model-price__value">{opt.priceOut}</span>
          </span>
        </span>
        {opt.priceNote ? (
          <span className="composer-model-price__unit">{opt.priceNote}</span>
        ) : null}
      </span>
    )
  }

  if (opt.priceNote) {
    return <span className="composer-model-meta composer-model-meta--note">{opt.priceNote}</span>
  }

  return null
}

export function ChatModelMenu({
  value,
  options,
  onChange,
  categoryChoices,
  selectionMode = 'custom',
  onCategoryModelChange,
  imageModelValue,
  imageModelOptions = [],
  generateImages = false,
  onGenerateImagesChange,
  onImageModelChange,
  imageGenerationDisabled = false,
  disabled,
  triggerVariant = 'icon',
  open: openControlled,
  onOpenChange,
}: ChatModelMenuProps) {
  const { t, navigate } = useApp() as { t: (key: string) => string; navigate: (p: string) => void }
  const [openInternal, setOpenInternal] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = openControlled !== undefined
  const open = isControlled ? openControlled : openInternal

  function setMenuOpen(next: boolean) {
    if (!isControlled) setOpenInternal(next)
    onOpenChange?.(next)
  }

  useCloseOnClickOutside(rootRef, open, () => setMenuOpen(false))

  const manualOptions = useMemo(
    () => options.filter((o) => o.id !== AUTO_MODEL_ID && o.id !== MAX_MODEL_ID),
    [options],
  )
  const groupedManualOptions = useMemo(() => {
    const rows = manualOptions.map((o) => {
      const baseCategory = (o.menuCategory ?? 'code') as ChatModelCategory
      const baseCategories = o.menuCategories?.length ? o.menuCategories : [baseCategory]
      // Imagen del menú = modelos de generación (imageModelOptions), no bucket OCR del catálogo.
      const withoutImage = baseCategories.filter((c) => c !== 'image')
      const menuCategories = (
        withoutImage.length > 0 ? withoutImage : ['code']
      ) as ChatModelCategory[]
      return {
        ...o,
        menuCategory: menuCategories[0],
        menuCategories: menuCategories.length > 1 ? menuCategories : undefined,
        priceSortKey: o.priceSortKey ?? Number.POSITIVE_INFINITY,
      }
    })
    return groupOptionsByChatCategory(rows)
  }, [manualOptions])

  const showImageGenerationMenu = imageModelOptions.length > 0

  const categoryTitleKey: Record<ChatModelCategory, string> = {
    code: 'chat.modelMenu.categoryCode',
    image: 'chat.modelMenu.categoryImage',
  }

  const [expandedCategories, setExpandedCategories] = useState<Set<ChatModelCategory>>(new Set())

  const choices = categoryChoices ?? EMPTY_CATEGORY_CHOICES

  useEffect(() => {
    if (!open) setExpandedCategories(new Set())
  }, [open])

  function toggleCategory(category: ChatModelCategory) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const hasDisabledManual = manualOptions.some((o) => !o.enabled)
  const isAuto = selectionMode === 'auto'
  const isMax = selectionMode === 'max'

  function pickGlobal(id: string) {
    onChange(id)
    setMenuOpen(false)
  }

  function pickCategory(category: ChatModelCategory, id: string, enabled: boolean) {
    if (!enabled) return
    onCategoryModelChange?.(category, id)
  }

  function pickImageModel(modelId: string) {
    if (imageGenerationDisabled || !onImageModelChange || !onGenerateImagesChange) return
    if (modelId === imageModelValue && generateImages) {
      onGenerateImagesChange(false)
      return
    }
    onImageModelChange(modelId)
    onGenerateImagesChange(true)
  }

  const modelLabel = useMemo(() => {
    if (selectionMode === 'auto') return t('chat.modelMenu.autoTitle')
    if (selectionMode === 'max') return t('chat.modelMenu.maxTitle')
    const hasCategoryPick = CHAT_MODEL_CATEGORY_ORDER.some((c) => Boolean(choices[c]))
    if (hasCategoryPick) return t('chat.modelMenu.modelsPill')
    return resolveModelLabel(value, options, t)
  }, [selectionMode, choices, options, value, t])
  const usePillTrigger = triggerVariant === 'pill'

  return (
    <div
      className={`composer-menu-anchor${usePillTrigger ? ' composer-menu-anchor--pill' : ''}`}
      ref={rootRef}
    >
      {usePillTrigger ? (
        <button
          type="button"
          className={`chat-model-pill-trigger${open ? ' is-open' : ''}`}
          aria-label={t('chat.modelMenu.open')}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setMenuOpen(!open)}
        >
          <Icon.Spark />
          <span className="chat-model-pill-trigger__label">{modelLabel}</span>
          <Icon.Chevron />
        </button>
      ) : (
        <ComposerToolButton
          label={t('chat.modelMenu.open')}
          active={open}
          disabled={disabled}
          onClick={() => setMenuOpen(!open)}
        >
          <Icon.Sliders />
        </ComposerToolButton>
      )}
      {open && (
        <div className="composer-menu composer-menu--model" role="menu">
          <p className="composer-menu-heading">{t('chat.modelMenu.title')}</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isAuto}
            className={`composer-menu-item composer-menu-item--model${isAuto ? ' is-selected' : ''}`}
            onClick={() => pickGlobal(AUTO_MODEL_ID)}
          >
            <span className="composer-menu-item-icon composer-menu-item-icon--accent">
              <Icon.Spark />
            </span>
            <span className="composer-menu-item-body">
              <span className="composer-model-head">
                <span className="composer-model-head__name">{t('chat.modelMenu.autoTitle')}</span>
              </span>
              <span className="composer-menu-item-desc">{t('chat.modelMenu.autoDesc')}</span>
            </span>
            {isAuto && (
              <span className="composer-menu-item-check" aria-hidden>
                <Icon.Check />
              </span>
            )}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={isMax}
            className={`composer-menu-item composer-menu-item--model${isMax ? ' is-selected' : ''}`}
            onClick={() => pickGlobal(MAX_MODEL_ID)}
          >
            <span className="composer-menu-item-icon composer-menu-item-icon--max">
              <Icon.Bolt />
            </span>
            <span className="composer-menu-item-body">
              <span className="composer-model-head">
                <span className="composer-model-head__name">{t('chat.modelMenu.maxTitle')}</span>
              </span>
              <span className="composer-menu-item-desc">{t('chat.modelMenu.maxDesc')}</span>
            </span>
            {isMax && (
              <span className="composer-menu-item-check" aria-hidden>
                <Icon.Check />
              </span>
            )}
          </button>

          {manualOptions.length > 0 && <div className="composer-menu-divider" role="separator" />}

          {CHAT_MODEL_CATEGORY_ORDER.map((category) => {
            if (category === 'image') {
              if (!showImageGenerationMenu) return null
              const expanded = expandedCategories.has('image')
              const categoryLabel = t(categoryTitleKey.image)
              return (
                <div key="image" className="composer-menu-category">
                  <button
                    type="button"
                    className={`composer-menu-category-trigger${expanded ? ' is-open' : ''}`}
                    aria-expanded={expanded}
                    aria-controls="composer-model-submenu-image"
                    onClick={() => toggleCategory('image')}
                  >
                    <span className="composer-menu-category-trigger__label">{categoryLabel}</span>
                    <span className="composer-menu-category-trigger__count" aria-hidden>
                      {imageModelOptions.length}
                    </span>
                    <span className="composer-menu-category-trigger__chevron" aria-hidden>
                      <Icon.Chevron />
                    </span>
                  </button>
                  {expanded ? (
                    <div
                      id="composer-model-submenu-image"
                      className="composer-menu-submenu"
                      role="group"
                      aria-label={categoryLabel}
                    >
                      {imageGenerationDisabled ? (
                        <p className="composer-menu-note composer-menu-note--warning">
                          {t('chat.imageModelMenu.disabledAdmin')}
                        </p>
                      ) : null}
                      {imageModelOptions.map((opt) => {
                        const selected = imageModelValue === opt.id && generateImages
                        return (
                          <button
                            key={`image-model-${opt.id}`}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            disabled={imageGenerationDisabled}
                            className={`composer-menu-item composer-menu-item--model${selected ? ' is-selected' : ''}`}
                            onClick={() => pickImageModel(opt.id)}
                          >
                            <span className="composer-menu-item-body">
                              <span className="composer-model-head">
                                <span className="composer-model-head__name">{opt.label}</span>
                              </span>
                              <span className="composer-menu-item-desc composer-menu-item-desc--mono">
                                {opt.id}
                              </span>
                              {opt.perImage ? (
                                <span className="composer-model-meta composer-model-meta--note">
                                  {opt.perImage}
                                </span>
                              ) : null}
                            </span>
                            {selected ? (
                              <span className="composer-menu-item-check" aria-hidden>
                                <Icon.Check />
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            }

            const categoryOptions = groupedManualOptions[category]
            if (!categoryOptions.length) return null
            const expanded = expandedCategories.has(category)
            const categoryLabel = t(categoryTitleKey[category])
            return (
              <div key={category} className="composer-menu-category">
                <button
                  type="button"
                  className={`composer-menu-category-trigger${expanded ? ' is-open' : ''}`}
                  aria-expanded={expanded}
                  aria-controls={`composer-model-submenu-${category}`}
                  onClick={() => toggleCategory(category)}
                >
                  <span className="composer-menu-category-trigger__label">{categoryLabel}</span>
                  <span className="composer-menu-category-trigger__count" aria-hidden>
                    {categoryOptions.length}
                  </span>
                  <span className="composer-menu-category-trigger__chevron" aria-hidden>
                    <Icon.Chevron />
                  </span>
                </button>
                {expanded ? (
                  <div
                    id={`composer-model-submenu-${category}`}
                    className="composer-menu-submenu"
                    role="group"
                    aria-label={categoryLabel}
                  >
                    {categoryOptions.map((opt) => {
                      const selected =
                        selectionMode === 'custom' && choices[category] === opt.id
                      return (
                        <button
                          key={`${category}-${opt.id}`}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          disabled={!opt.enabled}
                          className={`composer-menu-item composer-menu-item--model${selected ? ' is-selected' : ''}${!opt.enabled ? ' is-disabled' : ''}`}
                          onClick={() => pickCategory(category, opt.id, opt.enabled)}
                        >
                          <span className="composer-menu-item-body">
                            <span className="composer-model-head">
                              <span className="composer-model-head__name">{opt.label}</span>
                            </span>
                            <ModelPriceMeta opt={opt} t={t} />
                          </span>
                          {selected && opt.enabled && (
                            <span className="composer-menu-item-check" aria-hidden>
                              <Icon.Check />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}

          {hasDisabledManual && (
            <button
              type="button"
              className="composer-menu-upgrade"
              onClick={() => {
                navigate('/pricing')
                setMenuOpen(false)
              }}
            >
              <Icon.Bolt />
              <span>{t('chat.modelMenu.upgrade')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
