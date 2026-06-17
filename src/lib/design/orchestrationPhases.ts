/**
 * Fases compactas del orquestador para el log del Studio (menos líneas en UI).
 * Opt-out: DESIGN_VERBOSE_PHASES=1
 */

/** Agrupa fases técnicas en pasos legibles para el usuario. */
export function orchestrationPhaseGroup(phase: string): string {
  if (
    phase === 'visual-audit' ||
    phase === 'visual-audit-ready' ||
    phase === 'visual-audit-failed' ||
    phase === 'design-md' ||
    phase === 'design-md-ready' ||
    phase.startsWith('design-md') ||
    phase === 'layout-from-visual-audit' ||
    phase === 'tokens-review' ||
    phase === 'stitch-parity' ||
    phase === 'visual-identity' ||
    phase === 'palette-generation' ||
    phase === 'typography-ui'
  ) {
    return 'design-system'
  }

  if (phase === 'layout-planning') return 'layout'

  if (
    phase === 'content-generation' ||
    phase.startsWith('html-build:') ||
    phase.match(/^page:[^:]+:1\/\d+$/) ||
    phase.match(/^page:[^:]+:html$/) ||
    phase.match(/^html:[^:]+/) ||
    phase.match(/^page:[^:]+:html-retry:/) ||
    phase.match(/^page:[^:]+:html-failed/) ||
    phase.match(/^page:[^:]+:html-fidelity-failed/)
  ) {
    return 'html'
  }

  if (phase.match(/^page:[^:]+:html-review$/)) return 'html-refine'

  if (
    phase === 'asset-planning' ||
    phase === 'asset-generation' ||
    phase === 'images' ||
    phase === 'images-failed' ||
    phase.startsWith('images-unavailable:') ||
    phase.startsWith('page-assets:') ||
    phase.startsWith('image:')
  ) {
    return 'assets'
  }

  return phase
}

export function preferCompactOrchestrationPhases(): boolean {
  const raw = process.env.DESIGN_VERBOSE_PHASES?.trim().toLowerCase()
  return raw !== '1' && raw !== 'true' && raw !== 'yes'
}

export function wrapOrchestrationPhaseSend(
  send: ((type: string, data: string) => void) | undefined,
): ((type: string, data: string) => void) | undefined {
  if (!send) return undefined
  if (!preferCompactOrchestrationPhases()) return send

  let lastGroup: string | null = null
  return (type, data) => {
    if (type !== 'phase') {
      send(type, data)
      return
    }
    const group = orchestrationPhaseGroup(data)
    if (group === lastGroup) return
    lastGroup = group
    send(type, group)
  }
}
