import type { ScaffoldFile, ScaffoldFramework } from '@/lib/scaffolds/types'
import { nextScaffold } from '@/lib/scaffolds/next'
import { reactScaffold } from '@/lib/scaffolds/react'
import { vanillaScaffold } from '@/lib/scaffolds/vanilla'
import { canvasAppScaffold } from '@/lib/scaffolds/canvas-app'
import { canvasGameScaffold } from '@/lib/scaffolds/canvas-game'
import { p5SketchScaffold } from '@/lib/scaffolds/p5sketch'
import { phaserGameScaffold } from '@/lib/scaffolds/phaser-game'
import { threeSceneScaffold } from '@/lib/scaffolds/three-scene'

const SCAFFOLDS: Record<ScaffoldFramework, (name: string) => ScaffoldFile[]> = {
  next: nextScaffold,
  react: reactScaffold,
  vue: reactScaffold,
  svelte: reactScaffold,
  astro: reactScaffold,
  vanilla: vanillaScaffold,
  'canvas-app': canvasAppScaffold,
  'canvas-game': canvasGameScaffold,
  p5: p5SketchScaffold,
  phaser: phaserGameScaffold,
  three: threeSceneScaffold,
}

export function getScaffold(framework: string, projectName: string): ScaffoldFile[] {
  const fw = (framework in SCAFFOLDS ? framework : 'react') as ScaffoldFramework
  return SCAFFOLDS[fw](projectName)
}

export function scaffoldSummary(framework: string): string {
  const files = getScaffold(framework, 'App')
  return files.map((f) => f.path).join(', ')
}
