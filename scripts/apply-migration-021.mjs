#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx', ['supabase', 'db', 'push', '--linked', '--yes'], {
  stdio: 'inherit',
  shell: false,
})
process.exit(r.status ?? 1)
