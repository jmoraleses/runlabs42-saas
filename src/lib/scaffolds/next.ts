import type { ScaffoldFile } from '@/lib/scaffolds/types'

export function nextScaffold(_name: string): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'runlabs-app',
          private: true,
          scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
          dependencies: { next: '^14.0.0', react: '^18.2.0', 'react-dom': '^18.2.0' },
        },
        null,
        2,
      ),
      language: 'json',
    },
    {
      path: 'src/app/layout.tsx',
      content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
`,
      language: 'typescript',
    },
    {
      path: 'src/app/page.tsx',
      content: `export default function Home() {
  return <main style={{ minHeight: '100dvh' }} />
}
`,
      language: 'typescript',
    },
    {
      path: 'src/app/globals.css',
      content: `:root { color-scheme: light dark; }
body { background: #fafafa; color: #111; }
`,
      language: 'css',
    },
  ]
}
