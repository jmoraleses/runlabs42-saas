import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { resolveStitchZipRoots } from '@/lib/auto/orchestrator/stitchZipPaths'

describe('stitchZipPaths', () => {
  it('resolves stitch-zip root under Downloads', () => {
    const roots = resolveStitchZipRoots()
    expect(roots.root).toBe(path.join(os.homedir(), 'Downloads', 'stitch-zip'))
    expect(roots.inputsRoot.endsWith(path.join('stitch-zip', 'inputs'))).toBe(true)
    expect(roots.outputsRoot.endsWith(path.join('stitch-zip', 'outputs'))).toBe(true)
  })
})
