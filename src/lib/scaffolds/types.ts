export type ScaffoldFile = {
  path: string
  content: string
  language?: string
}

export const CANVAS_FRAMEWORKS = [
  'canvas-app',
  'canvas-game',
  'p5',
  'phaser',
  'three',
] as const

export type CanvasFramework = (typeof CANVAS_FRAMEWORKS)[number]

export const WEB_FRAMEWORKS = [
  'next',
  'react',
  'vue',
  'svelte',
  'astro',
  'vanilla',
  'solid',
] as const

export type WebFramework = (typeof WEB_FRAMEWORKS)[number]

export const ALL_PROJECT_FRAMEWORKS = [...WEB_FRAMEWORKS, ...CANVAS_FRAMEWORKS] as const

export type ProjectFramework = (typeof ALL_PROJECT_FRAMEWORKS)[number]

export type ScaffoldFramework =
  | 'next'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'astro'
  | 'vanilla'
  | CanvasFramework

export function isCanvasFramework(fw: string): fw is CanvasFramework {
  return (CANVAS_FRAMEWORKS as readonly string[]).includes(fw)
}

export function isValidProjectFramework(fw: string): fw is ProjectFramework {
  return (ALL_PROJECT_FRAMEWORKS as readonly string[]).includes(fw)
}
