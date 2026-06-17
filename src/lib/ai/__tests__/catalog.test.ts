import { describe, expect, it } from 'vitest'
import {
  formatPrice,
  PRICE_MARGIN,
  getCatalogModel,
  MODEL_CATALOG,
  modelPriceSortKey,
} from '@/lib/ai/catalog'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'

describe('formatPrice', () => {
  it('formats token pricing in Spanish', () => {
    const model = getCatalogModel('gemini-2.5-flash-lite')
    expect(model).toBeDefined()
    const line = formatPrice(model!, 'es', 1)
    expect(line).toContain('$0.10')
    expect(line).toContain('$0.40')
  })

  it('applies PRICE_MARGIN', () => {
    const model = getCatalogModel('gemini-2.5-flash-lite')
    const base = formatPrice(model!, 'en', 1)
    const withMargin = formatPrice(model!, 'en', 1.5)
    expect(withMargin).not.toBe(base)
    expect(withMargin).toContain('$0.15')
  })

  it('formats gemini-2.0-flash-lite pricing', () => {
    const model = getCatalogModel('gemini-2.0-flash-lite')
    expect(model).toBeDefined()
    const line = formatPrice(model!, 'en', 1)
    expect(line).toContain('$0.075')
    expect(line).toContain('$0.30')
  })

  it('formats gemini-3.1-flash-lite pricing', () => {
    const model = getCatalogModel('gemini-3.1-flash-lite')
    expect(model).toBeDefined()
    const line = formatPrice(model!, 'en', 1)
    expect(line).toContain('$0.25')
    expect(line).toContain('$1.50')
  })
})

describe('modelPriceSortKey', () => {
  it('orders chat models from cheapest to most expensive via latencyRank', () => {
    const chat = MODEL_CATALOG.filter(
      (m) =>
        m.category === 'text' &&
        m.enabled &&
        m.id !== AUTO_MODEL_ID &&
        m.id !== MAX_MODEL_ID &&
        (m.status === 'ga' || m.status === 'preview'),
    ).sort((a, b) => a.latencyRank - b.latencyRank)

    for (let i = 1; i < chat.length; i++) {
      expect(modelPriceSortKey(chat[i - 1]!)).toBeLessThanOrEqual(modelPriceSortKey(chat[i]!))
    }
  })
})

describe('PRICE_MARGIN', () => {
  it('defaults to 1.0', () => {
    expect(PRICE_MARGIN).toBe(1)
  })
})
