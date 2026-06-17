# Next.js

- id: nextjs
- category: framework
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if [ ! -f package.json ]; then printf '{\n  "name": "nextjs-template",\n  "private": true,\n  "scripts": {"dev": "next dev", "build": "next build"}\n}\n' > package.json; fi`
- `mkdir -p app && if [ ! -f app/page.tsx ]; then printf 'export default function Page() {\n  return <main>Next.js template listo</main>\n}\n' > app/page.tsx; fi`
