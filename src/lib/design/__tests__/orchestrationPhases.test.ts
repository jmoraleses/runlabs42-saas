import { describe, expect, it } from 'vitest'
import {
  orchestrationPhaseGroup,
  preferCompactOrchestrationPhases,
  wrapOrchestrationPhaseSend,
} from '@/lib/design/orchestrationPhases'

describe('orchestrationPhases', () => {
  it('agrupa fases técnicas en macros', () => {
    expect(orchestrationPhaseGroup('visual-audit')).toBe('design-system')
    expect(orchestrationPhaseGroup('design-md-ready')).toBe('design-system')
    expect(orchestrationPhaseGroup('layout-from-visual-audit')).toBe('design-system')
    expect(orchestrationPhaseGroup('layout-planning')).toBe('layout')
    expect(orchestrationPhaseGroup('content-generation')).toBe('html')
    expect(orchestrationPhaseGroup('html-build:monolith')).toBe('html')
    expect(orchestrationPhaseGroup('page:home:1/1')).toBe('html')
    expect(orchestrationPhaseGroup('page:home:html')).toBe('html')
    expect(orchestrationPhaseGroup('html:home:1/1')).toBe('html')
    expect(orchestrationPhaseGroup('page:home:html-review')).toBe('html-refine')
    expect(orchestrationPhaseGroup('page-assets:home:1/1')).toBe('assets')
  })

  it('deduplica fases compactas consecutivas', () => {
    const prev = process.env.DESIGN_VERBOSE_PHASES
    delete process.env.DESIGN_VERBOSE_PHASES
    expect(preferCompactOrchestrationPhases()).toBe(true)

    const phases: string[] = []
    const send = wrapOrchestrationPhaseSend((type, data) => {
      if (type === 'phase') phases.push(data)
    })
    send?.('phase', 'visual-audit')
    send?.('phase', 'design-md')
    send?.('phase', 'design-md-ready')
    send?.('phase', 'content-generation')
    send?.('phase', 'page:home:1/1')
    send?.('phase', 'page:home:html')
    send?.('phase', 'page:home:html-review')
    send?.('phase', 'page-assets:home:1/1')

    expect(phases).toEqual(['design-system', 'html', 'html-refine', 'assets'])

    if (prev === undefined) delete process.env.DESIGN_VERBOSE_PHASES
    else process.env.DESIGN_VERBOSE_PHASES = prev
  })
})
