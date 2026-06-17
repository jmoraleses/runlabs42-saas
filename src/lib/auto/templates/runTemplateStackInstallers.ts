import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { spawn } from 'child_process'

export type TemplateRunItem = {
  id: string
  label: string
  status: 'ready' | 'manual' | 'cloud'
  path: string
  notes: string
}

export type TemplateRunResult = {
  id: string
  label: string
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
  scriptPath: string
}

function runShellScript(scriptPath: string, cwd: string): Promise<{
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
}> {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
    child.on('error', (err) => {
      resolve({
        ok: false,
        code: null,
        stdout: stdout.trim(),
        stderr: `${stderr}\n${String(err.message)}`.trim(),
      })
    })
  })
}

export async function runTemplateStackInstallers(
  workspaceRoot: string,
  options?: {
    stackIds?: string[]
    includeManual?: boolean
    includeCloud?: boolean
  },
): Promise<{
  runLogPath: string
  results: TemplateRunResult[]
}> {
  const installersRoot = path.join(workspaceRoot, 'spec', 'template-stack-installers')
  const manifestPath = path.join(installersRoot, 'manifest.json')
  const raw = await readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw) as { stacks?: TemplateRunItem[] }
  const stacks = Array.isArray(parsed.stacks) ? parsed.stacks : []
  const includeManual = options?.includeManual === true
  const includeCloud = options?.includeCloud === true
  const selectedSet =
    Array.isArray(options?.stackIds) && options?.stackIds.length
      ? new Set(options?.stackIds)
      : null

  const executableStatuses: Array<TemplateRunItem['status']> = ['ready']
  if (includeManual) executableStatuses.push('manual')
  if (includeCloud) executableStatuses.push('cloud')

  const executableStacks = stacks.filter(
    (s) =>
      executableStatuses.includes(s.status) && (!selectedSet || selectedSet.has(s.id)),
  )

  const results: TemplateRunResult[] = []
  for (const stack of executableStacks) {
    const scriptPath = path.join(workspaceRoot, stack.path, 'install.sh')
    const out = await runShellScript(scriptPath, path.dirname(scriptPath))
    results.push({
      id: stack.id,
      label: stack.label,
      ok: out.ok,
      code: out.code,
      stdout: out.stdout,
      stderr: out.stderr,
      scriptPath: path.relative(workspaceRoot, scriptPath),
    })
  }

  const runsDir = path.join(installersRoot, 'runs')
  await mkdir(runsDir, { recursive: true })
  const runLogPath = path.join(runsDir, `${Date.now()}-run.json`)
  await writeFile(
    runLogPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        options: {
          includeManual,
          includeCloud,
          stackIds: selectedSet ? [...selectedSet] : null,
        },
        results,
      },
      null,
      2,
    ),
    'utf8',
  )

  return {
    runLogPath: path.relative(workspaceRoot, runLogPath),
    results,
  }
}
