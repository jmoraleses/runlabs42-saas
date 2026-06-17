export type GithubFile = { path: string; content: string }

export type GithubRepo = {
  id: number
  full_name: string
  name: string
  private: boolean
  default_branch?: string
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])
const MAX_FILES = 500
const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function ghFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `GitHub API ${res.status}`)
  }
  return res.json() as Promise<unknown>
}

export async function listUserRepos(token: string): Promise<GithubRepo[]> {
  const data = (await ghFetch(token, '/user/repos?per_page=100&sort=updated')) as GithubRepo[]
  return data
}

function shouldSkipPath(path: string): boolean {
  const parts = path.split('/')
  return parts.some((p) => SKIP_DIRS.has(p) || p.startsWith('.'))
}

export async function fetchRepoFiles(params: {
  token: string
  repo: string
  branch?: string
}): Promise<GithubFile[]> {
  const { token, repo, branch: branchParam } = params
  const [owner, name] = repo.split('/')
  if (!owner || !name) throw new Error('Repositorio inválido (usa owner/repo)')

  const repoMeta = (await ghFetch(token, `/repos/${owner}/${name}`)) as {
    default_branch: string
  }
  const branch = branchParam || repoMeta.default_branch || 'main'

  const refData = (await ghFetch(
    token,
    `/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`,
  )) as { object: { sha: string } }
  const sha = refData.object.sha

  const tree = (await ghFetch(
    token,
    `/repos/${owner}/${name}/git/trees/${sha}?recursive=1`,
  )) as {
    tree: { path: string; type: string; size?: number }[]
  }

  const blobs = tree.tree
    .filter((e) => e.type === 'blob')
    .filter((e) => !shouldSkipPath(e.path))
    .filter((e) => (e.size ?? 0) <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES)

  const files: GithubFile[] = []
  for (const entry of blobs) {
    const contentRes = await ghFetch(
      token,
      `/repos/${owner}/${name}/contents/${encodeURIComponent(entry.path)}?ref=${encodeURIComponent(branch)}`,
    )
    const item = contentRes as { content?: string; encoding?: string }
    if (item.encoding !== 'base64' || !item.content) continue
    const content = Buffer.from(item.content.replace(/\n/g, ''), 'base64').toString('utf8')
    if (content.includes('\0')) continue
    files.push({ path: entry.path, content })
  }

  return files
}
