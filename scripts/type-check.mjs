#!/usr/bin/env node
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pnpmDir = join(__dirname, '..', 'node_modules', '.pnpm')
const typeScriptDir = readdirSync(pnpmDir).find(d => d.startsWith('typescript@'))
const tscBin = join(pnpmDir, typeScriptDir, 'node_modules', 'typescript', 'bin', 'tsc')

execFile('node', ['--stack-size=65536', tscBin, '--noEmit'], {
  stdio: 'inherit',
}, (error) => {
  process.exit(error ? 1 : 0)
})
