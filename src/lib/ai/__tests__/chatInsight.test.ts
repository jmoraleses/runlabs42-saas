import { describe, expect, it } from 'vitest'
import { buildChatInsight } from '@/lib/ai/chatInsight.server'
import { heuristicInsight, parseInsightJson } from '@/lib/ai/chatInsight.shared'

describe('chatInsight', () => {
  it('heuristic classifies game prompts', () => {
    const insight = heuristicInsight({
      prompt: 'Crea un juego de plataformas con canvas',
      command: '/build',
      framework: 'next',
    })
    expect(insight.typology).toBe('game')
    expect(insight.suggestedFramework).toMatch(/canvas-game|phaser/)
  })

  it('heuristic classifies drawing prompts as canvas-app', () => {
    const insight = heuristicInsight({
      prompt: 'Quiero una pizarra para dibujar y pintar',
      command: '/build',
    })
    expect(insight.typology).toBe('creative')
    expect(insight.suggestedFramework).toBe('canvas-app')
  })

  it('heuristic classifies three.js prompts', () => {
    const insight = heuristicInsight({
      prompt: 'Escena 3D con three.js y un cubo',
      command: '/build',
    })
    expect(insight.suggestedFramework).toBe('three')
  })

  it('parses valid JSON from model output', () => {
    const parsed = parseInsightJson(
      '{"typology":"landing","summary":"Landing de producto","stackHint":"Next.js"}',
    )
    expect(parsed?.typology).toBe('landing')
    expect(parsed?.summary).toContain('Landing')
  })
})
