import { describe, expect, it } from 'vitest'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import {
  categoryModelsForApi,
  effectiveModelChoice,
  legacyChoiceToSelection,
  parseChatModelSelection,
  setCategoryModel,
  setGlobalModelMode,
} from '@/lib/ai/chatModelChoices'

describe('chatModelChoices', () => {
  it('parsea selección por categoría', () => {
    const raw = JSON.stringify({
      mode: 'custom',
      categories: { code: 'gpt-oss-20b-maas', image: 'deepseek-ai/deepseek-ocr-2' },
    })
    const sel = parseChatModelSelection(raw)
    expect(sel?.mode).toBe('custom')
    expect(sel?.categories.code).toBe('gpt-oss-20b-maas')
    expect(sel?.categories.image).toBe('deepseek-ai/deepseek-ocr-2')
  })

  it('migra categoría text legacy a code', () => {
    const raw = JSON.stringify({
      mode: 'custom',
      categories: { text: 'gemini-2.5-flash', code: '', image: '' },
    })
    const sel = parseChatModelSelection(raw)
    expect(sel?.categories.code).toBe('gemini-2.5-flash')
  })

  it('migra elección legacy', () => {
    expect(legacyChoiceToSelection(AUTO_MODEL_ID).mode).toBe('auto')
    expect(legacyChoiceToSelection(MAX_MODEL_ID).mode).toBe('max')
    expect(legacyChoiceToSelection('gemini-2.5-flash').categories.code).toBe('gemini-2.5-flash')
  })

  it('expone model por categoría en API', () => {
    expect(effectiveModelChoice(setGlobalModelMode(legacyChoiceToSelection(AUTO_MODEL_ID), 'max'))).toBe(
      MAX_MODEL_ID,
    )
    const custom = setCategoryModel(legacyChoiceToSelection('gemini-2.5-flash'), 'code', 'gpt-oss-20b-maas')
    expect(categoryModelsForApi(custom)).toEqual({
      code: 'gpt-oss-20b-maas',
      image: '',
    })
  })
})
