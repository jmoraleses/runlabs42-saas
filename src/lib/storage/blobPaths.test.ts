import { describe, expect, it } from 'vitest'
import {
  chatImageBlobPath,
  chatMessagesPrefix,
  chatSessionPrefix,
  demoProjectsPrefix,
  projectChatPrefix,
  projectFileBlobPath,
} from './blobPaths'

describe('blobPaths', () => {
  it('builds project file paths safely', () => {
    expect(projectFileBlobPath('user-1', 'proj-1', 'src/App.tsx')).toBe(
      'projects/user-1/proj-1/src/App.tsx',
    )
    expect(projectFileBlobPath('user-1', 'proj-1', '../secret')).toBe(
      'projects/user-1/proj-1/secret',
    )
  })

  it('builds chat session paths scoped to project', () => {
    expect(chatSessionPrefix('u', 'p', 's')).toBe('chat/u/p/s/')
    expect(chatImageBlobPath('u', 'p', 's', 'img-1')).toBe('chat/u/p/s/img-1')
    expect(projectChatPrefix('u', 'p')).toBe('chat/u/p/')
    expect(chatMessagesPrefix('u', 'p')).toBe('chat-messages/u/p/')
  })

  it('builds demo project prefix', () => {
    expect(demoProjectsPrefix('demo-abc')).toBe('demo-projects/demo-abc/')
  })
})
