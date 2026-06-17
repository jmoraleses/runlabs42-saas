#!/usr/bin/env node
/**
 * Sincroniza un proyecto Stitch → uploads/stitch-reference/{projectId}/
 * (design.md, HTML, PNG, meta.json). Pega el prompt original en prompt.txt.
 *
 * Uso:
 *   npm run stitch:sync
 *   npm run stitch:sync -- 2510768920948183313 c41095306a6146ed9bd54a0c72fc5b32
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT = process.argv[2]?.trim() || '2510768920948183313'
const SCREEN = process.argv[3]?.trim() || 'c41095306a6146ed9bd54a0c72fc5b32'

function stitchKey() {
  if (process.env.STITCH_API_KEY?.trim()) return process.env.STITCH_API_KEY.trim()
  const mcp = JSON.parse(readFileSync(resolve(homedir(), '.cursor/mcp.json'), 'utf8'))
  return mcp.mcpServers?.stitch?.headers?.['X-Goog-Api-Key']
}

async function stitchTool(name, args) {
  const r = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': stitchKey(),
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const j = await r.json()
  if (j.error) throw new Error(JSON.stringify(j.error))
  return JSON.parse(j.result?.content?.[0]?.text || '{}')
}

function designMdFromTheme(project) {
  const t = project.designTheme
  const nc = t?.namedColors ?? {}
  const name = project.title?.trim() || 'Stitch'
  const font = (t?.headlineFont ?? t?.font ?? 'Inter').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const lines = Object.entries(nc).map(([k, v]) => `  ${k.replace(/_/g, '-')}: '${v}'`)
  return [
    '---',
    `name: ${name}`,
    'colors:',
    ...lines,
    'typography:',
    '  headline-xl:',
    `    fontFamily: ${font}`,
    "    fontSize: 48px",
    "    fontWeight: '700'",
    '  body-md:',
    `    fontFamily: ${font}`,
    "    fontSize: 16px",
    "    fontWeight: '400'",
    '---',
    '',
    `# ${name}`,
    '',
    '## Brand & Style',
    `Fuente: ${font}. Modo ${t?.colorMode ?? 'LIGHT'}.`,
  ].join('\n')
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  const outDir = resolve(root, 'uploads', 'stitch-reference', PROJECT)
  mkdirSync(outDir, { recursive: true })

  const list = await stitchTool('list_projects', {})
  const project = (list.projects ?? []).find((p) => p.name?.includes(PROJECT))
  if (!project) throw new Error(`Proyecto ${PROJECT} no encontrado`)

  const designMd = project.designMd?.trim() || designMdFromTheme(project)
  writeFileSync(resolve(outDir, 'design.md'), designMd, 'utf8')

  const screenName = `projects/${PROJECT}/screens/${SCREEN}`
  const screenData = await stitchTool('get_screen', {
    name: screenName,
    projectId: PROJECT,
    screenId: SCREEN,
  })
  const screen = screenData.screen ?? screenData

  await download(screen.htmlCode.downloadUrl, resolve(outDir, `screen-${SCREEN}.html`))
  await download(screen.screenshot.downloadUrl, resolve(outDir, `screen-${SCREEN}.png`))

  writeFileSync(
    resolve(outDir, 'meta.json'),
    JSON.stringify(
      {
        projectId: PROJECT,
        screenId: SCREEN,
        title: project.title,
        screenTitle: screen.title,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  const promptPath = resolve(outDir, 'prompt.txt')
  const placeholder = `# Pega aquí el prompt original de Stitch para este proyecto\n# (la API de Stitch no expone el historial de prompts)\n`
  try {
    const existing = readFileSync(promptPath, 'utf8')
    if (!existing.trim()) writeFileSync(promptPath, placeholder)
  } catch {
    writeFileSync(promptPath, placeholder)
  }

  console.log(`✓ ${outDir}`)
  console.log(`  design.md, screen-${SCREEN}.html, screen-${SCREEN}.png`)
  console.log(`  Edita prompt.txt con el texto que usaste en Stitch.`)
  console.log(`  Genera en Studio con brief.stitchProjectId: "${PROJECT}"`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
