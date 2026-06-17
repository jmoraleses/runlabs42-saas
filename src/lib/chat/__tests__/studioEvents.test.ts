import { describe, expect, it } from 'vitest'
import { appendStudioChatEvent } from '@/lib/chat/studioEvents'
import type { ChatMessage } from '@/lib/chat/types'

const fixing = (file: string): ChatMessage => ({
  role: 'assistant',
  content: '',
  studioEvent: { kind: 'compile-fixing', file, attempt: 1, max: 50 },
})

const error = (file: string): ChatMessage => ({
  role: 'assistant',
  content: '',
  studioEvent: { kind: 'compile-error', summary: 'boom', file },
})

describe('appendStudioChatEvent', () => {
  it('elimina fixing anteriores al iniciar otro archivo', () => {
    const base = [error('src/App.tsx'), fixing('src/App.tsx')]
    const next = appendStudioChatEvent(base, {
      kind: 'compile-fixing',
      file: 'src/pages/Home.tsx',
      attempt: 2,
      max: 50,
    })
    const fixingMsgs = next.filter((m) => m.studioEvent?.kind === 'compile-fixing')
    expect(fixingMsgs).toHaveLength(1)
    expect(fixingMsgs[0]!.studioEvent).toMatchObject({
      kind: 'compile-fixing',
      file: 'src/pages/Home.tsx',
    })
  })

  it('quita spinners al marcar fallo o éxito', () => {
    const base = [error('src/App.tsx'), fixing('src/App.tsx')]
    const failed = appendStudioChatEvent(base, { kind: 'compile-failed' })
    expect(failed.some((m) => m.studioEvent?.kind === 'compile-fixing')).toBe(false)
    expect(failed[failed.length - 1]!.studioEvent?.kind).toBe('compile-failed')
  })
})
