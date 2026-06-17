import { describe, expect, it } from 'vitest'
import {
  isValidWorkspacePath,
  normalizeGeneratedPath,
  normalizeWorkspacePath,
  resolveWorkspacePath,
} from '@/lib/projects/workspacePath'

describe('workspacePath', () => {
  it('rechaza rutas vacías', () => {
    expect(isValidWorkspacePath('')).toBe(false)
    expect(isValidWorkspacePath('   ')).toBe(false)
    expect(normalizeWorkspacePath('', 'src/App.tsx')).toBe('src/App.tsx')
  })

  it('prefiere src/App.tsx si el modelo emite App.tsx en raíz', () => {
    expect(
      resolveWorkspacePath('App.tsx', { existingPaths: ['src/App.tsx', 'src/main.tsx'] }),
    ).toBe('src/App.tsx')
  })

  it('antepone src/ a pages y context cuando el proyecto usa src/', () => {
    const existing = ['src/App.tsx', 'src/main.tsx']
    expect(normalizeGeneratedPath('pages/Home.tsx', existing)).toBe('src/pages/Home.tsx')
    expect(normalizeGeneratedPath('context/AuthContext.tsx', existing)).toBe(
      'src/context/AuthContext.tsx',
    )
    expect(normalizeGeneratedPath('components/ProtectedRoute.tsx', existing)).toBe(
      'src/components/ProtectedRoute.tsx',
    )
    expect(resolveWorkspacePath('pages/Dashboard.tsx', { existingPaths: existing })).toBe(
      'src/pages/Dashboard.tsx',
    )
  })
})
