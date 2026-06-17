// Copia el runtime de Monaco a /public para servirlo desde el mismo origen
// (evita el CDN jsdelivr y mantiene un CSP estricto: script-src 'self').
import { cpSync, existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

let monacoPkg
try {
  monacoPkg = require.resolve('monaco-editor/package.json')
} catch {
  console.error('[copy-monaco] monaco-editor no está instalado; omitiendo copia.')
  process.exit(0)
}

const src = join(dirname(monacoPkg), 'min', 'vs')
const dest = join(process.cwd(), 'public', 'monaco', 'vs')

if (!existsSync(src)) {
  console.error(`[copy-monaco] No se encontró ${src}; omitiendo.`)
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log(`[copy-monaco] Monaco copiado a ${dest}`)
