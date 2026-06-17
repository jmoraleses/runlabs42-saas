#!/usr/bin/env node
/**
 * E2E local del pipeline publish (requiere servidor en marcha + auth).
 *
 *   BASE_URL=http://localhost:3010 PROJECT_ID=... SESSION_COOKIE="..." node scripts/e2e-publish-site.mjs
 */
const base = process.env.BASE_URL ?? 'http://localhost:3010'
const projectId = process.env.PROJECT_ID
const cookie = process.env.SESSION_COOKIE

if (!projectId) {
  console.error('Define PROJECT_ID')
  process.exit(1)
}

async function main() {
  const res = await fetch(`${base}/api/projects/${projectId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ framework: 'next' }),
  })
  if (!res.ok) {
    console.error('Publish failed', res.status, await res.text())
    process.exit(1)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const event = JSON.parse(line.slice(6))
      console.log('[publish]', event.phase, event.message ?? event.url ?? '')
      if (event.phase === 'done') {
        console.log('OK', event.url)
        process.exit(0)
      }
      if (event.phase === 'error') {
        console.error(event.message)
        process.exit(1)
      }
    }
  }
  console.error('Stream ended without done')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
