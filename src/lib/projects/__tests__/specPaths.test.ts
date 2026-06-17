import { describe, expect, it } from 'vitest'
import {
  isSpecWorkspacePath,
  migrateLegacySpecPath,
  migrateSpecFiles,
  SPEC_KIT_PATHS,
} from '@/lib/projects/specPaths'

describe('specPaths', () => {
  it('migrates legacy specs/ paths to spec/', () => {
    expect(migrateLegacySpecPath('specs/plan.md')).toBe('spec/plan.md')
    expect(migrateLegacySpecPath('spec/plan.md')).toBe('spec/plan.md')
  })

  it('detects spec workspace paths', () => {
    expect(isSpecWorkspacePath('spec/plan.md')).toBe(true)
    expect(isSpecWorkspacePath('src/App.tsx')).toBe(false)
  })

  it('dedupes migrated files preferring spec/', () => {
    const files = migrateSpecFiles([
      { path: 'specs/plan.md', content: 'old' },
      { path: 'spec/plan.md', content: 'new' },
    ])
    expect(files).toEqual([{ path: 'spec/plan.md', content: 'new' }])
  })

  it('uses spec.md as primary spec content', () => {
    expect(
      migrateSpecFiles([{ path: SPEC_KIT_PATHS.spec, content: '# Spec' }])[0]?.path,
    ).toBe('spec/spec.md')
  })
})
