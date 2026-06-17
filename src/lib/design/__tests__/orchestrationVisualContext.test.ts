import { describe, expect, it } from 'vitest'
import {
  mergeOrchestrationImageParts,
  orchestrationHasVisualReference,
} from '@/lib/design/orchestrationVisualContext'

describe('mergeOrchestrationImageParts', () => {
  it('combina imágenes de usuario sin duplicar', () => {
    const user = [{ mimeType: 'image/png', data: 'abc' }]
    expect(mergeOrchestrationImageParts(user, null)).toEqual(user)
  })

  it('detecta referencia visual con stitch sin PNG local', () => {
    expect(
      orchestrationHasVisualReference([], {
        projectId: '1',
        designMd: '---\nname: x\n---',
      }),
    ).toBe(false)
    expect(orchestrationHasVisualReference([{ mimeType: 'image/png', data: 'x' }], null)).toBe(
      true,
    )
  })
})
