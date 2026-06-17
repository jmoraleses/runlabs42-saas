import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

export type TemplateStackInstallStatus = 'ready' | 'manual' | 'cloud'

export type TemplateStackResult = {
  id: string
  label: string
  status: TemplateStackInstallStatus
  path: string
  notes: string
}

const STACKS: Array<{
  id: string
  label: string
  type: TemplateStackInstallStatus
  category: 'framework' | 'cms' | 'ecommerce' | 'misc'
}> = [
  { id: 'wordpress', label: 'WordPress', type: 'ready', category: 'cms' },
  { id: 'html', label: 'HTML', type: 'ready', category: 'framework' },
  { id: 'nextjs', label: 'Next.js', type: 'ready', category: 'framework' },
  { id: 'jekyll', label: 'Jekyll', type: 'ready', category: 'framework' },
  { id: 'gatsbyjs', label: 'Gatsby.js', type: 'ready', category: 'framework' },
  { id: 'misc-web', label: 'Miscellaneous (Web)', type: 'manual', category: 'misc' },
  { id: 'nuxtjs', label: 'Nuxt.js', type: 'ready', category: 'framework' },
  { id: 'sveltekit', label: 'SvelteKit', type: 'ready', category: 'framework' },
  { id: 'joomla', label: 'Joomla', type: 'ready', category: 'cms' },
  { id: 'drupal', label: 'Drupal', type: 'ready', category: 'cms' },
  { id: 'hubspot-cms-hub', label: 'HubSpot CMS Hub', type: 'cloud', category: 'cms' },
  { id: 'moodle', label: 'Moodle', type: 'ready', category: 'cms' },
  { id: 'modx-themes', label: 'MODX Themes', type: 'manual', category: 'cms' },
  { id: 'webflow', label: 'Webflow', type: 'cloud', category: 'cms' },
  { id: 'misc-cms', label: 'Miscellaneous (CMS)', type: 'manual', category: 'misc' },
  { id: 'concrete5', label: 'Concrete5', type: 'manual', category: 'cms' },
  { id: 'weebly', label: 'Weebly', type: 'cloud', category: 'cms' },
  { id: 'shopify', label: 'Shopify', type: 'cloud', category: 'ecommerce' },
  { id: 'prestashop', label: 'PrestaShop', type: 'ready', category: 'ecommerce' },
  { id: 'opencart', label: 'OpenCart', type: 'ready', category: 'ecommerce' },
  { id: 'magento', label: 'Magento', type: 'ready', category: 'ecommerce' },
  { id: 'bigcommerce', label: 'BigCommerce', type: 'cloud', category: 'ecommerce' },
  { id: 'zencart', label: 'Zen Cart', type: 'manual', category: 'ecommerce' },
]

const READY_INSTALL_COMMANDS: Record<string, string[]> = {
  wordpress: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f wp-local >/dev/null 2>&1 || true; docker run --name wp-local -p 8080:80 -d wordpress:latest >/dev/null; echo 'WordPress listo: http://localhost:8080'; else echo 'Docker no disponible: WordPress omitido'; fi",
  ],
  html: [
    "mkdir -p preview && if [ ! -f preview/index.html ]; then printf '<!doctype html><html><head><meta charset=\"utf-8\"><title>HTML Template</title></head><body><h1>HTML template listo</h1></body></html>\\n' > preview/index.html; fi",
    "echo 'HTML scaffold listo en preview/index.html'",
  ],
  nextjs: [
    "if [ ! -f package.json ]; then printf '{\\n  \"name\": \"nextjs-template\",\\n  \"private\": true,\\n  \"scripts\": {\"dev\": \"next dev\", \"build\": \"next build\"}\\n}\\n' > package.json; fi",
    "mkdir -p app && if [ ! -f app/page.tsx ]; then printf 'export default function Page() {\\n  return <main>Next.js template listo</main>\\n}\\n' > app/page.tsx; fi",
  ],
  jekyll: [
    "if [ ! -f _config.yml ]; then printf 'title: Jekyll Template\\n' > _config.yml; fi",
    "mkdir -p _posts && if [ ! -f index.md ]; then printf '# Jekyll template listo\\n' > index.md; fi",
  ],
  gatsbyjs: [
    "if [ ! -f package.json ]; then printf '{\\n  \"name\": \"gatsby-template\",\\n  \"private\": true,\\n  \"scripts\": {\"develop\": \"gatsby develop\", \"build\": \"gatsby build\"}\\n}\\n' > package.json; fi",
    "if [ ! -f gatsby-config.js ]; then printf 'module.exports = { siteMetadata: { title: \"Gatsby Template\" } }\\n' > gatsby-config.js; fi",
  ],
  nuxtjs: [
    "if [ ! -f package.json ]; then printf '{\\n  \"name\": \"nuxt-template\",\\n  \"private\": true,\\n  \"scripts\": {\"dev\": \"nuxt dev\", \"build\": \"nuxt build\"}\\n}\\n' > package.json; fi",
    "mkdir -p pages && if [ ! -f pages/index.vue ]; then printf '<template><main>Nuxt template listo</main></template>\\n' > pages/index.vue; fi",
  ],
  sveltekit: [
    "if [ ! -f package.json ]; then printf '{\\n  \"name\": \"sveltekit-template\",\\n  \"private\": true,\\n  \"scripts\": {\"dev\": \"vite dev\", \"build\": \"vite build\"}\\n}\\n' > package.json; fi",
    "mkdir -p src/routes && if [ ! -f src/routes/+page.svelte ]; then printf '<main>SvelteKit template listo</main>\\n' > src/routes/+page.svelte; fi",
  ],
  joomla: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f joomla-local >/dev/null 2>&1 || true; docker run --name joomla-local -p 8082:80 -d joomla:latest >/dev/null; echo 'Joomla listo: http://localhost:8082'; else echo 'Docker no disponible: Joomla omitido'; fi",
  ],
  drupal: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f drupal-local >/dev/null 2>&1 || true; docker run --name drupal-local -p 8083:80 -d drupal:latest >/dev/null; echo 'Drupal listo: http://localhost:8083'; else echo 'Docker no disponible: Drupal omitido'; fi",
  ],
  moodle: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f moodle-local >/dev/null 2>&1 || true; docker run --name moodle-local -p 8084:8080 -d bitnami/moodle:latest >/dev/null; echo 'Moodle listo: http://localhost:8084'; else echo 'Docker no disponible: Moodle omitido'; fi",
  ],
  prestashop: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f prestashop-local >/dev/null 2>&1 || true; docker run --name prestashop-local -p 8085:80 -d prestashop/prestashop:latest >/dev/null; echo 'PrestaShop listo: http://localhost:8085'; else echo 'Docker no disponible: PrestaShop omitido'; fi",
  ],
  opencart: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f opencart-local >/dev/null 2>&1 || true; docker run --name opencart-local -p 8086:8080 -d bitnami/opencart:latest >/dev/null; echo 'OpenCart listo: http://localhost:8086'; else echo 'Docker no disponible: OpenCart omitido'; fi",
  ],
  magento: [
    "if command -v docker >/dev/null 2>&1; then docker rm -f magento-local >/dev/null 2>&1 || true; docker run --name magento-local -p 8087:8080 -d bitnami/magento:latest >/dev/null; echo 'Magento listo: http://localhost:8087'; else echo 'Docker no disponible: Magento omitido'; fi",
  ],
}

function templateNotes(id: string, status: TemplateStackInstallStatus): string {
  if (status === 'cloud') {
    return 'Cloud platform: requires account auth and deployment through provider APIs.'
  }
  if (status === 'manual') {
    return 'Manual adapter scaffold created. Add provider-specific installer steps.'
  }
  return READY_INSTALL_COMMANDS[id]
    ? 'Local one-click profile generated with runnable commands.'
    : 'Local profile generated.'
}

export async function setupTemplateStacks(workspaceRoot: string): Promise<{
  rootPath: string
  manifestPath: string
  results: TemplateStackResult[]
}> {
  const rootPath = path.join(workspaceRoot, 'spec', 'template-stack-installers')
  await mkdir(rootPath, { recursive: true })

  const results: TemplateStackResult[] = []

  for (const stack of STACKS) {
    const stackPath = path.join(rootPath, stack.id)
    await mkdir(stackPath, { recursive: true })
    const commands = READY_INSTALL_COMMANDS[stack.id] ?? []
    const notes = templateNotes(stack.id, stack.type)

    const readme = [
      `# ${stack.label}`,
      '',
      `- id: ${stack.id}`,
      `- category: ${stack.category}`,
      `- status: ${stack.type}`,
      `- notes: ${notes}`,
      '',
      '## Install steps',
      '',
      ...(commands.length ? commands.map((c) => `- \`${c}\``) : ['- No automatic command available yet.']),
      '',
    ].join('\n')
    await writeFile(path.join(stackPath, 'README.md'), readme, 'utf8')

    await writeFile(
      path.join(stackPath, 'install.sh'),
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '',
        ...(commands.length
          ? commands
          : ['echo "No automatic install command available for this stack yet."']),
        '',
      ].join('\n'),
      'utf8',
    )

    results.push({
      id: stack.id,
      label: stack.label,
      status: stack.type,
      path: path.relative(workspaceRoot, stackPath),
      notes,
    })
  }

  const manifestPath = path.join(rootPath, 'manifest.json')
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rootPath: path.relative(workspaceRoot, rootPath),
        stacks: results,
      },
      null,
      2,
    ),
    'utf8',
  )

  return {
    rootPath: path.relative(workspaceRoot, rootPath),
    manifestPath: path.relative(workspaceRoot, manifestPath),
    results,
  }
}
