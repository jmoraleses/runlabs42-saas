import { ghFetch, type GithubFile } from './githubApi'

function repoSlug(projectName: string): string {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `runlabs42-${base || 'app'}-${Date.now().toString(36)}`
}

export type { GithubFile }

export async function publishToGithub(params: {
  token: string
  projectName: string
  files: GithubFile[]
  existingRepo?: string | null
}): Promise<{ repoFullName: string; htmlUrl: string }> {
  const { token, projectName, files, existingRepo } = params
  if (!files.length) throw new Error('No hay archivos para publicar')

  let owner: string
  let repo: string

  if (existingRepo?.includes('/')) {
    const parts = existingRepo.split('/')
    owner = parts[0]!
    repo = parts[1]!
  } else {
    const user = (await ghFetch(token, '/user')) as { login: string }
    owner = user.login
    repo = repoSlug(projectName)
    await ghFetch(token, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: repo,
        private: false,
        auto_init: true,
        description: `Publicado desde Runlabs42 — ${projectName}`,
      }),
    })
  }

  for (const file of files) {
    const encoded = encodeURIComponent(file.path)
    let sha: string | undefined
    try {
      const existing = (await ghFetch(
        token,
        `/repos/${owner}/${repo}/contents/${encoded}?ref=main`,
      )) as { sha?: string }
      sha = existing.sha
    } catch {
      /* nuevo archivo */
    }

    await ghFetch(token, `/repos/${owner}/${repo}/contents/${encoded}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update ${file.path} via Runlabs42`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch: 'main',
        ...(sha ? { sha } : {}),
      }),
    })
  }

  const htmlUrl = `https://github.com/${owner}/${repo}`
  return { repoFullName: `${owner}/${repo}`, htmlUrl }
}
