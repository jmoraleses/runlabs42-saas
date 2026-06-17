import type { CodeTemplate } from '@/lib/codeTemplates'

export function buildVercelJson(codeTemplate: CodeTemplate): string {
  const routes =
    codeTemplate === 'html'
      ? [
          { handle: 'filesystem' },
          { src: '/(.*)', dest: '/preview/index.html' },
        ]
      : [
          { handle: 'filesystem' },
          { src: '/preview/(.*)', dest: '/preview/$1' },
          { src: '/(.*)', dest: '/preview/index.html' },
        ]

  return JSON.stringify(
    {
      version: 2,
      cleanUrls: true,
      trailingSlash: false,
      routes,
    },
    null,
    2,
  )
}
