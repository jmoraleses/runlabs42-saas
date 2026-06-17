import { describe, expect, it } from 'vitest'
import {
  CHAT_MODEL_CATEGORY_ORDER,
  groupOptionsByChatCategory,
  resolveChatModelCategories,
  resolveChatModelCategory,
} from '@/lib/ai/chatModelCategories'

describe('chatModelCategories', () => {
  it('solo expone Código y OCR en el menú', () => {
    expect(CHAT_MODEL_CATEGORY_ORDER).toEqual(['code', 'image'])
  })

  it('ordena por precio dentro de cada categoría', () => {
    const grouped = groupOptionsByChatCategory([
      { id: 'b', menuCategory: 'code', priceSortKey: 2, label: 'B' },
      { id: 'a', menuCategory: 'code', priceSortKey: 0.5, label: 'A' },
      { id: 'c', menuCategory: 'image', priceSortKey: 1, label: 'C' },
    ] as Array<{ id: string; menuCategory: 'code' | 'image'; priceSortKey: number; label: string }>)
    expect(grouped.code.map((m) => m.id)).toEqual(['a', 'b'])
    expect(grouped.image.map((m) => m.id)).toEqual(['c'])
  })

  it('mapea buckets admin a categorías de chat (language → code)', () => {
    const visibility = {
      language: ['gemini-2.5-flash'],
      coding: ['gpt-oss-20b-maas'],
      ocr: ['deepseek-ai/deepseek-ocr-2'],
    }
    expect(resolveChatModelCategory('gemini-2.5-flash', visibility)).toBe('code')
    expect(resolveChatModelCategory('gpt-oss-20b-maas', visibility)).toBe('code')
    expect(resolveChatModelCategory('deepseek-ai/deepseek-ocr-2', visibility)).toBe('image')
  })

  it('con visibilidad admin, language aparece en Código', () => {
    const visibility = {
      language: ['gemini-2.5-flash', 'gpt-oss-20b-maas'],
      coding: ['gpt-oss-20b-maas'],
      ocr: ['deepseek-ai/deepseek-ocr-2'],
    }
    expect(resolveChatModelCategories('gemini-2.5-flash', visibility)).toEqual(['code'])
    expect(resolveChatModelCategories('gpt-oss-20b-maas', visibility)).toEqual(['code']) // language+coding → code
    expect(resolveChatModelCategories('deepseek-ai/deepseek-ocr-2', visibility)).toEqual(['image'])

    const grouped = groupOptionsByChatCategory([
      {
        id: 'gemini-2.5-flash',
        menuCategories: resolveChatModelCategories('gemini-2.5-flash', visibility),
        priceSortKey: 1,
      },
      {
        id: 'gpt-oss-20b-maas',
        menuCategories: resolveChatModelCategories('gpt-oss-20b-maas', visibility),
        priceSortKey: 2,
      },
      {
        id: 'deepseek-ai/deepseek-ocr-2',
        menuCategories: resolveChatModelCategories('deepseek-ai/deepseek-ocr-2', visibility),
        priceSortKey: 0.5,
      },
    ])
    expect(grouped.code.map((m) => m.id)).toEqual(['gemini-2.5-flash', 'gpt-oss-20b-maas'])
    expect(grouped.image.map((m) => m.id)).toEqual(['deepseek-ai/deepseek-ocr-2'])
    expect(grouped.code.some((m) => m.id === 'deepseek-ai/deepseek-ocr-2')).toBe(false)
  })
})
