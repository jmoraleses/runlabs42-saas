export type Rgb = { r: number; g: number; b: number }

export type Hsv = { h: number; s: number; v: number }

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function clampHue(h: number): number {
  const v = h % 360
  return v < 0 ? v + 360 : v
}

export function isTransparentColor(value: string): boolean {
  const v = value.trim().toLowerCase()
  return !v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)'
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function hexToRgb(hex: string): Rgb | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m?.[1]) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h: clampHue(h), s, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) {
    rp = c
    gp = x
  } else if (h < 120) {
    rp = x
    gp = c
  } else if (h < 180) {
    gp = c
    bp = x
  } else if (h < 240) {
    gp = x
    bp = c
  } else if (h < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  }
}

export function parseInspectorColor(value: string): Rgb | null {
  if (isTransparentColor(value)) return null
  const hex = hexToRgb(value)
  if (hex) return hex
  const rgbMatch = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgbMatch) {
    return {
      r: clampByte(Number(rgbMatch[1])),
      g: clampByte(Number(rgbMatch[2])),
      b: clampByte(Number(rgbMatch[3])),
    }
  }
  return null
}

export function formatInspectorColor(rgb: Rgb): string {
  return rgbToHex(rgb)
}

export function inspectorColorCss(value: string, fallback = '#ffffff'): string {
  if (isTransparentColor(value)) return 'transparent'
  const rgb = parseInspectorColor(value)
  return rgb ? formatInspectorColor(rgb) : fallback
}

export function defaultPickerRgb(value: string): Rgb {
  return parseInspectorColor(value) ?? { r: 59, g: 130, b: 246 }
}
