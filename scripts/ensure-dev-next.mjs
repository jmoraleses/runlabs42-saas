#!/usr/bin/env node
/**
 * Tras `pnpm build`, la carpeta `.next` de producción puede romper `next dev`
 * (MODULE_NOT_FOUND en chunks de /studio). Borramos .next al volver a dev.
 */
import { existsSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const marker = join(root, '.next-production-build')
const nextDir = join(root, '.next')

if (!existsSync(marker)) {
  process.exit(0)
}

try {
  unlinkSync(marker)
} catch {
  /* ignore */
}

if (existsSync(nextDir)) {
  console.warn('[dev] Eliminando .next de producción (evita MODULE_NOT_FOUND en dev)…')
  rmSync(nextDir, { recursive: true, force: true })
}
