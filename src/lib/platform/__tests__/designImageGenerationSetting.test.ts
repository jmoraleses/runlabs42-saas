import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESIGN_IMAGE_GENERATION_SETTING,
  parseDesignImageGenerationEnabled,
} from '@/lib/platform/designImageGenerationSetting'

describe('parseDesignImageGenerationEnabled', () => {
  it('devuelve true por defecto', () => {
    expect(DEFAULT_DESIGN_IMAGE_GENERATION_SETTING.enabled).toBe(true)
    expect(parseDesignImageGenerationEnabled(undefined)).toBe(true)
    expect(parseDesignImageGenerationEnabled(null)).toBe(true)
  })

  it('lee enabled del objeto guardado', () => {
    expect(parseDesignImageGenerationEnabled({ enabled: true })).toBe(true)
    expect(parseDesignImageGenerationEnabled({ enabled: false })).toBe(false)
  })
})
