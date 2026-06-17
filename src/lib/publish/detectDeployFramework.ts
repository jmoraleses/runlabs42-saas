export type DeployFramework = 'nextjs' | 'vite' | null

export function detectDeployFramework(
  files: Array<{ path: string; content: string }>,
): DeployFramework {
  const pkg = files.find((f) => f.path === 'package.json')
  if (!pkg?.content) {
    if (files.some((f) => f.path.startsWith('app/') && f.path.endsWith('.tsx'))) return 'nextjs'
    if (files.some((f) => f.path === 'index.html')) return 'vite'
    return null
  }
  try {
    const parsed = JSON.parse(pkg.content) as { dependencies?: Record<string, string> }
    if (parsed.dependencies?.next) return 'nextjs'
    if (files.some((f) => f.path.startsWith('app/') && /\.(tsx|jsx)$/.test(f.path))) return 'nextjs'
    return 'vite'
  } catch {
    return null
  }
}
