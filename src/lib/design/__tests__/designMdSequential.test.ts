import { describe, expect, it } from 'vitest'
import {
  assembleDesignMd,
  designMdStepSystemInstruction,
  DESIGN_MD_BUILD_STEPS,
  parseDesignMdStepOutput,
  runMonolithicDesignMdBuild,
  type DesignMdPartialState,
} from '@/lib/design/designMdSequential'
import { designMdIsRichEnough } from '@/lib/design/designMd'
import { RICH_STITCH_DESIGN_MD } from '@/lib/design/__tests__/fixtures/stitchDesignMdFixture'
import type { DesignBrief } from '@/lib/design/designBrief'

const brief: DesignBrief = {
  prompt: 'Tienda de cactus premium para urban gardeners',
  siteType: 'ecommerce',
  brandTone: 'organic minimalist botanical',
}

describe('designMdSequential', () => {
  it('define 13 pasos (YAML + 8 secciones)', () => {
    expect(DESIGN_MD_BUILD_STEPS.length).toBe(13)
    expect(DESIGN_MD_BUILD_STEPS.map((s) => s.id)).toContain('section-photography')
    expect(DESIGN_MD_BUILD_STEPS.map((s) => s.id)).toContain('colors-surfaces')
    expect(DESIGN_MD_BUILD_STEPS.map((s) => s.id)).toContain('section-components')
  })

  it('ensambla design.md rico desde estado parcial', () => {
    const fm = RICH_STITCH_DESIGN_MD.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
    const colorsBody = fm.match(/^colors:\r?\n([\s\S]*?)(?=^typography:)/m)?.[1] ?? ''
    const surfaces: string[] = []
    const roles: string[] = []
    for (const line of colorsBody.split('\n')) {
      const key = line.trim().match(/^([a-z0-9-]+):/i)?.[1]
      if (!key) continue
      if (/^(surface|on-surface|inverse|outline|background|surface-variant|surface-tint)/i.test(key)) {
        surfaces.push(line.trim())
      } else {
        roles.push(line.trim())
      }
    }

    const state: DesignMdPartialState = {
      name: 'Organic Minimalist Botanical',
      colorsSurfaces: surfaces.join('\n'),
      colorsRoles: roles.join('\n'),
      typography: fm.match(/^typography:\r?\n([\s\S]*?)(?=^rounded:)/m)?.[1]?.trimEnd(),
      shapeSpacing: [
        `rounded:\n${fm.match(/^rounded:\r?\n([\s\S]*?)(?=^spacing:)/m)?.[1]?.trimEnd()}`,
        `spacing:\n${fm.match(/^spacing:\r?\n([\s\S]*?)$/m)?.[1]?.trimEnd()}`,
      ].join('\n'),
      sections: {},
    }

    const narrative = RICH_STITCH_DESIGN_MD.slice(RICH_STITCH_DESIGN_MD.indexOf('\n---\n') + 5)
    for (const heading of [
      '## Brand & Style',
      '## Colors',
      '## Typography',
      '## Layout & Spacing',
      '## Elevation & Depth',
      '## Shapes',
      '## Photography & Imagery',
      '## Components',
    ] as const) {
      const re = new RegExp(
        `(${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`,
      )
      const m = narrative.match(re)
      if (m?.[1]) state.sections[heading] = m[1].trim()
    }

    const assembled = assembleDesignMd(state)
    expect(assembled).toContain('name: Organic Minimalist Botanical')
    expect(assembled).toContain('primary:')
    expect(assembled).toContain('## Brand & Style')
    expect(designMdIsRichEnough(assembled)).toBe(true)
  })

  it('designMdStepSystemInstruction con imagen refuerza layout y colores', () => {
    const withImg = designMdStepSystemInstruction('section-layout', true)
    expect(withImg).toContain('Imagen de referencia')
    expect(withImg).toContain('bento')
    const withoutImg = designMdStepSystemInstruction('section-layout', false)
    expect(withoutImg).not.toContain('Imagen de referencia')
  })

  it('runMonolithicDesignMdBuild usa plantilla desde brief si el modelo no entrega md rico', async () => {
    const resolved = await runMonolithicDesignMdBuild({
      brief,
      baseUserPrompt: 'Genera design.md',
      modelId: 'test-model',
      callText: async () => 'respuesta sin markdown válido',
    })
    expect(resolved.designMd).toContain('name:')
    expect(resolved.designMd).toContain('## Brand & Style')
    expect(designMdIsRichEnough(resolved.designMd)).toBe(true)
  })

  it('parsea fragmentos por paso', () => {
    expect(parseDesignMdStepOutput('name: Cactus Haven', 'name')).toContain('name:')
    expect(
      parseDesignMdStepOutput("  primary: '#061b0e'\n  secondary: '#51634f'", 'colors-roles'),
    ).toContain('primary')
    expect(
      parseDesignMdStepOutput(
        '## Brand & Style\n\nOrganic calm for plant lovers.',
        'section-brand',
      ),
    ).toContain('## Brand & Style')
  })
})
