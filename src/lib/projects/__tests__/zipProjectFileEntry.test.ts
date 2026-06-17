import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { zipProjectFileEntry } from '@/lib/projects/zipProjectFileEntry'

/** PNG 1×1 válido en base64. */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVQ42mP8z5BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('zipProjectFileEntry', () => {
  it('decodes raster images from base64 into binary zip entries', async () => {
    const { data, binary } = zipProjectFileEntry('design/mockups/home.png', TINY_PNG_B64)
    expect(binary).toBe(true)
    expect(data).toBeInstanceOf(Uint8Array)
    const bytes = data as Uint8Array
    expect(bytes[0]).toBe(0x89)
    expect(bytes[1]).toBe(0x50)

    const zip = new JSZip()
    zip.file('home.png', data, { binary: true })
    const out = await zip.file('home.png')!.async('uint8array')
    expect(out[0]).toBe(0x89)
    expect(out[1]).toBe(0x50)
  })

  it('decodes data URLs for raster images', () => {
    const { data, binary } = zipProjectFileEntry(
      'public/images/logo.png',
      `data:image/png;base64,${TINY_PNG_B64}`,
    )
    expect(binary).toBe(true)
    const bytes = data as Uint8Array
    expect(bytes[0]).toBe(0x89)
  })

  it('keeps text files as strings', () => {
    const { data, binary } = zipProjectFileEntry('src/App.tsx', 'export {}')
    expect(binary).toBeUndefined()
    expect(data).toBe('export {}')
  })

  it('keeps SVG markup as utf-8 text', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const { data, binary } = zipProjectFileEntry('public/icon.svg', svg)
    expect(binary).toBeUndefined()
    expect(data).toBe(svg)
  })
})
