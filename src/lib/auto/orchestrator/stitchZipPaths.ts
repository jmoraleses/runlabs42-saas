import path from 'node:path'
import os from 'node:os'
import { mkdir, readdir, stat } from 'node:fs/promises'
import {
  ORCHESTRATOR_PLATFORMS,
  type OrchestratorPlatformId,
} from '@/lib/auto/orchestrator/platforms'

export type StitchZipRoots = {
  root: string
  inputsRoot: string
  outputsRoot: string
}

export type StitchZipInputFile = {
  platformId: OrchestratorPlatformId
  fileName: string
  absolutePath: string
  sizeBytes: number
  updatedAt: string
}

export function resolveStitchZipRoots(): StitchZipRoots {
  const root = path.join(os.homedir(), 'Downloads', 'stitch-zip')
  return {
    root,
    inputsRoot: path.join(root, 'inputs'),
    outputsRoot: path.join(root, 'outputs'),
  }
}

export async function ensureStitchZipLayout(): Promise<StitchZipRoots> {
  const roots = resolveStitchZipRoots()
  await mkdir(roots.inputsRoot, { recursive: true })
  await mkdir(roots.outputsRoot, { recursive: true })
  for (const platform of ORCHESTRATOR_PLATFORMS) {
    await mkdir(path.join(roots.inputsRoot, platform.id), { recursive: true })
    await mkdir(path.join(roots.outputsRoot, platform.id), { recursive: true })
  }
  return roots
}

export async function listStitchZipInputs(): Promise<{
  roots: StitchZipRoots
  files: StitchZipInputFile[]
}> {
  const roots = await ensureStitchZipLayout()
  const files: StitchZipInputFile[] = []
  for (const platform of ORCHESTRATOR_PLATFORMS) {
    const dir = path.join(roots.inputsRoot, platform.id)
    const names = await readdir(dir).catch(() => [] as string[])
    for (const fileName of names) {
      if (!fileName.toLowerCase().endsWith('.zip')) continue
      const absolutePath = path.join(dir, fileName)
      const info = await stat(absolutePath).catch(() => null)
      if (!info?.isFile()) continue
      files.push({
        platformId: platform.id,
        fileName,
        absolutePath,
        sizeBytes: info.size,
        updatedAt: new Date(info.mtimeMs).toISOString(),
      })
    }
  }
  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { roots, files }
}
