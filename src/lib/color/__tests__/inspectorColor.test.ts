import { describe, it, expect } from 'vitest'
import {
  formatInspectorColor,
  hexToRgb,
  hsvToRgb,
  isTransparentColor,
  parseInspectorColor,
  rgbToHsv,
} from '@/lib/color/inspectorColor'

describe('inspectorColor', () => {
  it('parses hex and rgb', () => {
    expect(parseInspectorColor('#15f505')).toEqual({ r: 21, g: 245, b: 5 })
    expect(parseInspectorColor('rgb(21, 245, 5)')).toEqual({ r: 21, g: 245, b: 5 })
    expect(isTransparentColor('transparent')).toBe(true)
  })

  it('round-trips hsv', () => {
    const rgb = { r: 21, g: 245, b: 5 }
    const hex = formatInspectorColor(hsvToRgb(rgbToHsv(rgb)))
    expect(hexToRgb(hex)).toEqual(rgb)
  })
})
