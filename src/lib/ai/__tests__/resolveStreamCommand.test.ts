import { describe, expect, it } from 'vitest'
import { resolveStreamCommand } from '@/lib/ai/resolveStreamCommand'

describe('resolveStreamCommand', () => {
  it('uses explicit /build command', () => {
    const r = resolveStreamCommand({ prompt: '/build landing page', workspaceFileCount: 5 })
    expect(r.command).toBe('/build')
    expect(r.prompt).toBe('landing page')
    expect(r.inferredBuild).toBeUndefined()
  })

  it('uses explicit /plan command', () => {
    const r = resolveStreamCommand({ prompt: '/plan next steps', workspaceFileCount: 3 })
    expect(r.command).toBe('/plan')
    expect(r.prompt).toBe('next steps')
  })

  it('infers /build from natural language', () => {
    const r = resolveStreamCommand({
      prompt: 'Crea una landing con hero y formulario de contacto',
      workspaceFileCount: 2,
    })
    expect(r.command).toBe('/build')
    expect(r.inferredBuild).toBe(true)
  })

  it('infers /build when workspace is empty', () => {
    const r = resolveStreamCommand({
      prompt: 'App de tareas simple',
      workspaceFileCount: 0,
    })
    expect(r.command).toBe('/build')
    expect(r.inferredBuild).toBe(true)
  })

  it('stays /plan for plan-only questions', () => {
    const r = resolveStreamCommand({
      prompt: 'Explícame el plan del proyecto sin tocar código',
      workspaceFileCount: 0,
    })
    expect(r.command).toBe('/plan')
  })

  it('stays /plan for generic explanation', () => {
    const r = resolveStreamCommand({
      prompt: '¿Cómo funciona React Router en este proyecto?',
      workspaceFileCount: 4,
    })
    expect(r.command).toBe('/plan')
  })

  it('infers /build for change requests', () => {
    const r = resolveStreamCommand({
      prompt: 'Cambia el botón principal a color azul',
      workspaceFileCount: 8,
    })
    expect(r.command).toBe('/build')
    expect(r.inferredBuild).toBe(true)
  })

  it('infers /build for Spanish improve/design phrasing', () => {
    expect(
      resolveStreamCommand({
        prompt: 'Mejorar hero principal',
        workspaceFileCount: 3,
      }).command,
    ).toBe('/build')
    expect(
      resolveStreamCommand({
        prompt: 'Haz un diseño más elegante',
        workspaceFileCount: 3,
      }).command,
    ).toBe('/build')
    expect(
      resolveStreamCommand({
        prompt: 'Sí, procede con la fase 1',
        workspaceFileCount: 3,
      }).command,
    ).toBe('/build')
  })
})
