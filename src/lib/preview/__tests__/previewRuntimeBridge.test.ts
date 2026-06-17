import { describe, expect, it } from 'vitest'
import {
  PREVIEW_RUNTIME_ERROR_TYPE,
  buildPreviewRuntimeBridgeScript,
  isPreviewRuntimeErrorMessage,
} from '@/lib/preview/previewRuntimeBridge'

describe('previewRuntimeBridge', () => {
  it('detects runtime error postMessage payloads', () => {
    expect(
      isPreviewRuntimeErrorMessage({
        type: PREVIEW_RUNTIME_ERROR_TYPE,
        message: 'useNavigate is not defined',
      }),
    ).toBe(true)
    expect(isPreviewRuntimeErrorMessage({ type: 'other', message: 'x' })).toBe(false)
  })

  it('emits bridge script without breaking script tags', () => {
    const script = buildPreviewRuntimeBridgeScript()
    expect(script).toContain(PREVIEW_RUNTIME_ERROR_TYPE)
    expect(script).not.toMatch(/<\/script>/i)
  })
})
