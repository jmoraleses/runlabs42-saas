import { describe, expect, it } from 'vitest'
import { attachmentToApiPayload } from '@/lib/chat/imageAttachments'

describe('attachmentToApiPayload', () => {
  it('prioriza base64 del dataUrl sobre blobUrl', () => {
    const payload = attachmentToApiPayload({
      id: '1',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,abc123',
      name: 'ref.png',
      previewUrl: 'data:image/png;base64,abc123',
      blobUrl: 'https://example.com/blob.png',
    })
    expect(payload).toEqual({ mimeType: 'image/png', data: 'abc123' })
  })
})
