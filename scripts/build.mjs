#!/usr/bin/env node
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const nextBin = join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')

execFile('node', ['--stack-size=65536', nextBin, 'build'], {
  stdio: 'inherit',
}, (error) => {
  process.exit(error ? 1 : 0)
})
