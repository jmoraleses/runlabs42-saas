import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { inspectTemplateMonsterBundle } from '@/lib/auto/orchestrator/processStitchZipInput'

describe('processStitchZipInput helpers', () => {
  it('validates required TemplateMonster files in bundle', async () => {
    const zip = new JSZip()
    zip.file('marketplace/templatemonster/Documentation/index.html', '<html></html>')
    zip.file('marketplace/templatemonster/Demo Content/README.txt', 'demo')
    zip.file('marketplace/templatemonster/Preview/cover.png', 'x')
    const raw = await zip.generateAsync({ type: 'nodebuffer' })
    const tmpDir = path.join(os.tmpdir(), `tm-bundle-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
    const bundlePath = path.join(tmpDir, 'package.zip')
    await writeFile(bundlePath, raw)
    const result = await inspectTemplateMonsterBundle(bundlePath)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
    await rm(tmpDir, { recursive: true, force: true })
  })
})
