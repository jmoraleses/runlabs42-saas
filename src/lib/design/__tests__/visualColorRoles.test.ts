import { describe, expect, it } from 'vitest'
import {
  applyDominantColorsFallbackToDesignMd,
  applyVisualColorRolesToDesignMd,
  parseVisualColorRoles,
  snapVisualColorsToDesignMd,
  visualReferenceColorRolesBlock,
} from '@/lib/design/visualColorRoles'

const SAMPLE_DESIGN_MD = `---
name: PetVibe Catalog
colors:
  primary: '#111111'
  secondary: '#3f3d3c'
  tertiary: '#a0522d'
  background: '#ffffff'
  on-surface: '#1a1a1a'
  on-surface-variant: '#888888'
---
## Colors
Test
`

describe('visualColorRoles', () => {
  it('parseVisualColorRoles normaliza hex y roles landing', () => {
    const roles = parseVisualColorRoles({
      ctaPrimary: '3e5641',
      accentHighlight: '#8fbc8f',
      badgeNew: '#e67e5f',
      badgeTopSales: '#d4a5a5',
      pageBackground: '#f5f3ef',
    })
    expect(roles?.ctaPrimary).toBe('#3e5641')
    expect(roles?.accentHighlight).toBe('#8fbc8f')
    expect(roles?.pageBackground).toBe('#f5f3ef')
  })

  it('applyVisualColorRolesToDesignMd corrige primary/secondary/tertiary', () => {
    const out = applyVisualColorRolesToDesignMd(SAMPLE_DESIGN_MD, {
      ctaPrimary: '#3e5641',
      badgeNew: '#e67e5f',
      badgeTopSales: '#d4a5a5',
      pageBackground: '#f5f3ef',
      textPrimary: '#2c2c2c',
      textMuted: '#6b6b6b',
    })
    expect(out).toContain("primary: '#3e5641'")
    expect(out).toContain("secondary: '#d4a5a5'")
    expect(out).toContain("tertiary: '#e67e5f'")
    expect(out).toContain("background: '#f5f3ef'")
    expect(out).not.toContain("secondary: '#3f3d3c'")
  })

  it('applyDominantColorsFallbackToDesignMd infiere primary oscuro y fondo claro', () => {
    const out = applyDominantColorsFallbackToDesignMd(SAMPLE_DESIGN_MD, [
      '#f5f3ef',
      '#8fbc8f',
      '#3e5641',
    ])
    expect(out).toContain("background: '#f5f3ef'")
    expect(out).toContain("primary: '#3e5641'")
  })

  it('snapVisualColorsToDesignMd usa dominantColors si faltan colorRoles', () => {
    const out = snapVisualColorsToDesignMd(SAMPLE_DESIGN_MD, {
      dominantColors: ['#f5f3ef', '#5c7a5c'],
    })
    expect(out).toContain("primary: '#5c7a5c'")
    expect(out).toContain("background: '#f5f3ef'")
  })

  it('visualReferenceColorRolesBlock documenta mapeo M3', () => {
    const block = visualReferenceColorRolesBlock({
      ctaPrimary: '#3e5641',
      badgeNew: '#e67e5f',
      badgeTopSales: '#d4a5a5',
    })
    expect(block).toContain('tertiary')
    expect(block).toContain('#e67e5f')
    expect(block).toContain('secondary')
    expect(block).toContain('#d4a5a5')
  })
})
