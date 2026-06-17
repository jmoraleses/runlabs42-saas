import { describe, expect, it } from 'vitest'
import {
  inferFormFactorFromDimensions,
  readImageDimensionsFromBuffer,
  resolveOrchestrationDevice,
} from '@/lib/design/visualReferenceDevice'

describe('visualReferenceDevice', () => {
  it('inferFormFactorFromDimensions detecta móvil en ratio alto', () => {
    expect(inferFormFactorFromDimensions(390, 844)).toBe('mobile')
    expect(inferFormFactorFromDimensions(1280, 960)).toBe('desktop')
  })

  it('resolveOrchestrationDevice prioriza referenceFormFactor del audit', () => {
    expect(
      resolveOrchestrationDevice({
        requestedDevice: 'desktop',
        visualProfile: {
          layoutTopology: 'mobile-app-screen',
          sectionTypes: ['bottom-nav'],
          referenceFormFactor: 'mobile',
        },
      }),
    ).toBe('mobile')
  })

  it('readImageDimensionsFromBuffer lee PNG IHDR', () => {
    const buf = Buffer.alloc(24)
    buf[0] = 0x89
    buf[1] = 0x50
    buf[2] = 0x4e
    buf[3] = 0x47
    buf.writeUInt32BE(390, 16)
    buf.writeUInt32BE(844, 20)
    expect(readImageDimensionsFromBuffer(buf)).toEqual({ width: 390, height: 844 })
  })
})
