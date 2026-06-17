#!/usr/bin/env node
/**
 * Instalador interactivo de Runlabs42.
 * Uso: node scripts/install.mjs
 *      pnpm setup
 *      ./install.sh
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'

const root = process.cwd()
const envPath = resolve(root, '.env.local')
const examplePath = resolve(root, '.env.local.example')

const rl = createInterface({ input, output })

function log(msg = '') {
  output.write(`${msg}\n`)
}

function commandExists(cmd) {
  const r = spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' })
  return r.status === 0
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: opts.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: process.env,
  })
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`Comando falló: ${cmd} ${args.join(' ')}`)
  }
  return r
}

async function ask(question, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  return answer || defaultValue
}

async function askYesNo(question, defaultYes = true) {
  const hint = defaultYes ? 'S/n' : 's/N'
  const answer = (await rl.question(`${question} (${hint}): `)).trim().toLowerCase()
  if (!answer) return defaultYes
  return answer === 's' || answer === 'si' || answer === 'sí' || answer === 'y' || answer === 'yes'
}

async function askChoice(question, choices) {
  log(`\n${question}`)
  choices.forEach((c, i) => log(`  ${i + 1}) ${c.label}`))
  while (true) {
    const raw = (await rl.question(`Elige (1-${choices.length}): `)).trim()
    const n = Number(raw)
    if (n >= 1 && n <= choices.length) return choices[n - 1].value
    log('Opción no válida.')
  }
}

async function askSecret(question, optional = false) {
  while (true) {
    const value = (await rl.question(`${question}${optional ? ' (opcional, Enter para omitir)' : ''}: `)).trim()
    if (value || optional) return value
    log('Este valor es obligatorio.')
  }
}

function parseEnvFile(text) {
  const vars = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

function parseSupabaseStatusEnv(stdout) {
  const vars = {}
  for (const line of stdout.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

function quoteEnv(value) {
  if (value === '') return '""'
  if (/[\s#"'\\]/.test(value)) return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return value
}

function buildEnvFile(vars) {
  const sections = [
    {
      title: 'Públicas (cliente)',
      keys: [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_APP_URL',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_SENTRY_DSN',
      ],
    },
    {
      title: 'Supabase (servidor)',
      keys: [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'DATABASE_URL',
        'SUPABASE_ACCESS_TOKEN',
        'SUPABASE_ORG_SLUG',
        'SUPABASE_PROVISION_REGION',
        'ADMIN_EMAILS',
      ],
    },
    {
      title: 'IA / Vertex / Gemini',
      keys: [
        'AI_PROVIDER',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'GOOGLE_CLOUD_PROJECT_ID',
        'GOOGLE_CLOUD_LOCATION',
        'GEMINI_API_KEY',
        'GEMINI_MODEL',
        'DESIGN_GEN_MODEL',
        'USE_GENAI_APP_BUILDER_TRIAL_CREDIT',
        'IMAGE_GEN_ALLOW_API_KEY',
        'ALLOW_GEMINI_API_KEY_FALLBACK',
      ],
    },
    {
      title: 'Stripe y contacto',
      keys: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_STARTER',
        'STRIPE_PRICE_PRO',
        'STRIPE_PRICE_TEAM',
        'RESEND_API_KEY',
        'CONTACT_TO_EMAIL',
        'CONTACT_FROM_EMAIL',
      ],
    },
    {
      title: 'Integraciones OAuth',
      keys: [
        'INTEGRATIONS_ENCRYPTION_KEY',
        'GITHUB_OAUTH_CLIENT_ID',
        'GITHUB_OAUTH_CLIENT_SECRET',
        'FIGMA_OAUTH_CLIENT_ID',
        'FIGMA_OAUTH_CLIENT_SECRET',
        'VERCEL_INTEGRATION_CLIENT_ID',
        'VERCEL_INTEGRATION_CLIENT_SECRET',
        'VERCEL_INTEGRATION_SLUG',
        'STITCH_API_KEY',
        'STITCH_ACCOUNT_EMAIL',
      ],
    },
    {
      title: 'Otros',
      keys: [
        'BLOB_READ_WRITE_TOKEN',
        'USER_STORAGE_LIMIT_MB',
        'ANTHROPIC_API_KEY',
        'DEEPSEEK_API_KEY',
        'NODE_ENV',
      ],
    },
  ]

  const used = new Set()
  const lines = [
    '# Generado por scripts/install.mjs',
    `# ${new Date().toISOString()}`,
    '',
  ]

  for (const section of sections) {
    const present = section.keys.filter((k) => vars[k] !== undefined && vars[k] !== '')
    if (!present.length) continue
    lines.push(`# --- ${section.title} ---`)
    for (const key of present) {
      lines.push(`${key}=${quoteEnv(String(vars[key]))}`)
      used.add(key)
    }
    lines.push('')
  }

  const extra = Object.keys(vars).filter((k) => !used.has(k) && vars[k] !== '')
  if (extra.length) {
    lines.push('# --- Variables adicionales ---')
    for (const key of extra.sort()) {
      lines.push(`${key}=${quoteEnv(String(vars[key]))}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

function ensureDockerRunning() {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  if (r.status !== 0) {
    log('\nDocker no está en ejecución.')
    if (process.platform === 'darwin') {
      log('Intentando abrir Docker Desktop…')
      spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' })
      log('Espera a que Docker arranque y vuelve a ejecutar el instalador.')
    }
    throw new Error('Docker requerido para Supabase local')
  }
}

function loadLocalSupabaseEnv() {
  const r = run(
    'supabase',
    [
      'status',
      '-o',
      'env',
      '--override-name',
      'api.url=NEXT_PUBLIC_SUPABASE_URL',
      '--override-name',
      'anon.key=NEXT_PUBLIC_SUPABASE_ANON_KEY',
      '--override-name',
      'service_role.key=SUPABASE_SERVICE_ROLE_KEY',
      '--override-name',
      'db.url=DATABASE_URL',
      '--override-name',
      'publishable.key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ],
    { silent: true, allowFail: true },
  )
  if (r.status !== 0) {
    throw new Error('No se pudo leer `supabase status`. ¿Está Supabase local en marcha?')
  }
  return parseSupabaseStatusEnv(r.stdout || '')
}

async function setupLocalBase() {
  ensureDockerRunning()

  if (!commandExists('supabase')) {
    log('\nSupabase CLI no encontrado.')
    if (commandExists('brew')) {
      const install = await askYesNo('¿Instalar Supabase CLI con Homebrew?', true)
      if (install) {
        run('brew', ['install', 'supabase/tap/supabase'])
      } else {
        throw new Error('Instala Supabase CLI: https://supabase.com/docs/guides/cli')
      }
    } else {
      throw new Error('Instala Supabase CLI: https://supabase.com/docs/guides/cli')
    }
  }

  if (!existsSync(resolve(root, 'supabase/config.toml'))) {
    log('\nInicializando Supabase en el proyecto…')
    run('supabase', ['init'])
  }

  const statusProbe = spawnSync('supabase', ['status'], { cwd: root, stdio: 'pipe', encoding: 'utf8' })
  if (statusProbe.status !== 0) {
    log('\nArrancando Supabase local (Docker)…')
    run('supabase', ['start'])
  } else {
    log('\nSupabase local ya está en ejecución.')
  }

  if (await askYesNo('¿Aplicar migraciones con `supabase db reset`?', true)) {
    log('\nAplicando migraciones…')
    run('supabase', ['db', 'reset'])
  }

  const supa = loadLocalSupabaseEnv()
  return {
    NEXT_PUBLIC_SUPABASE_URL: supa.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supa.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supa.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || supa.PUBLISHABLE_KEY || '',
    SUPABASE_URL: supa.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    SUPABASE_ANON_KEY: supa.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_PUBLISHABLE_KEY: supa.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || supa.PUBLISHABLE_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: supa.SUPABASE_SERVICE_ROLE_KEY || '',
    DATABASE_URL: supa.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3010',
    NODE_ENV: 'development',
  }
}

async function setupProductionBase() {
  log('\nDatos de Supabase en la nube (Dashboard → Project Settings → API)')
  const url = await askSecret('NEXT_PUBLIC_SUPABASE_URL (ej. https://xxx.supabase.co)')
  const anon = await askSecret('NEXT_PUBLIC_SUPABASE_ANON_KEY (anon/public)')
  const service = await askSecret('SUPABASE_SERVICE_ROLE_KEY (service_role)')
  const publishable = await askSecret('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', true)
  const appUrl = await ask('NEXT_PUBLIC_APP_URL', 'https://tu-dominio.com')

  return {
    NEXT_PUBLIC_SUPABASE_URL: url.replace(/\/$/, ''),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_URL: url.replace(/\/$/, ''),
    SUPABASE_ANON_KEY: anon,
    SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SERVICE_ROLE_KEY: service,
    NEXT_PUBLIC_APP_URL: appUrl.replace(/\/$/, ''),
    NODE_ENV: 'production',
  }
}

async function configureAI(vars) {
  const aiChoice = await askChoice('¿Cómo quieres configurar la IA?', [
    { value: 'mock', label: 'Modo demo (sin Vertex/Gemini) — recomendado para empezar' },
    { value: 'vertex', label: 'Vertex AI (cuenta de servicio GCP)' },
    { value: 'gemini-key', label: 'Gemini API Key (AI Studio)' },
  ])

  if (aiChoice === 'mock') {
    vars.AI_PROVIDER = 'mock'
    return vars
  }

  vars.AI_PROVIDER = 'gemini'

  if (aiChoice === 'vertex') {
    const credPath = await ask(
      'GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio)',
    )
    const projectId = await ask('GOOGLE_CLOUD_PROJECT_ID')
    const location = await ask('GOOGLE_CLOUD_LOCATION', 'us-central1')
    vars.GOOGLE_APPLICATION_CREDENTIALS = credPath
    vars.GOOGLE_CLOUD_PROJECT_ID = projectId
    vars.GOOGLE_CLOUD_LOCATION = location
    vars.GEMINI_MODEL = await ask('GEMINI_MODEL', 'gemini-2.5-flash-lite')
    vars.DESIGN_GEN_MODEL = await ask('DESIGN_GEN_MODEL', 'gemini-2.5-flash')

    if (await askYesNo('¿Usar crédito trial GenAI App Builder?', false)) {
      vars.USE_GENAI_APP_BUILDER_TRIAL_CREDIT = '1'
      vars.IMAGE_GEN_ALLOW_API_KEY = '0'
      vars.ALLOW_GEMINI_API_KEY_FALLBACK = '0'
    }
    return vars
  }

  vars.GEMINI_API_KEY = await askSecret('GEMINI_API_KEY (AIza… desde aistudio.google.com)')
  vars.ALLOW_GEMINI_API_KEY_FALLBACK = '1'
  vars.GEMINI_MODEL = await ask('GEMINI_MODEL', 'gemini-2.5-flash-lite')
  return vars
}

async function configureOptionalIntegrations(vars, mode) {
  if (!(await askYesNo('¿Configurar Stripe (pagos)?', mode === 'production'))) return vars

  vars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = await askSecret('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_…)')
  vars.STRIPE_SECRET_KEY = await askSecret('STRIPE_SECRET_KEY (sk_…)')
  vars.STRIPE_WEBHOOK_SECRET = await askSecret('STRIPE_WEBHOOK_SECRET (whsec_…)', true)
  if (mode === 'production') {
    vars.STRIPE_PRICE_STARTER = await askSecret('STRIPE_PRICE_STARTER (price_…)', true)
    vars.STRIPE_PRICE_PRO = await askSecret('STRIPE_PRICE_PRO (price_…)', true)
    vars.STRIPE_PRICE_TEAM = await askSecret('STRIPE_PRICE_TEAM (price_…)', true)
  }
  return vars
}

async function configureAdminEmails(vars) {
  vars.ADMIN_EMAILS = await askSecret(
    'ADMIN_EMAILS (separados por coma, acceso al panel admin)',
    true,
  )
  return vars
}

async function configureContact(vars) {
  if (!(await askYesNo('¿Configurar formulario de contacto (Resend)?', false))) return vars
  vars.RESEND_API_KEY = await askSecret('RESEND_API_KEY (re_…)')
  vars.CONTACT_TO_EMAIL = await ask('CONTACT_TO_EMAIL', 'you@your-domain.com')
  vars.CONTACT_FROM_EMAIL = await ask(
    'CONTACT_FROM_EMAIL',
    'Tu App <onboarding@resend.dev>',
  )
  return vars
}

async function configureStitch(vars) {
  if (!(await askYesNo('¿Configurar integración Stitch (Google)?', false))) return vars
  vars.STITCH_API_KEY = await askSecret('STITCH_API_KEY')
  vars.STITCH_ACCOUNT_EMAIL = await askSecret('STITCH_ACCOUNT_EMAIL (cuenta Google)', true)
  return vars
}

async function configureBlob(vars) {
  if (!(await askYesNo('¿Configurar Vercel Blob (archivos de proyecto)?', false))) return vars
  vars.BLOB_READ_WRITE_TOKEN = await askSecret('BLOB_READ_WRITE_TOKEN')
  vars.USER_STORAGE_LIMIT_MB = await ask('USER_STORAGE_LIMIT_MB', '100')
  return vars
}

async function configureSupabaseProvision(vars, mode) {
  if (mode !== 'production') return vars
  if (!(await askYesNo('¿Provisionar proyectos Supabase por usuario (Management API)?', false))) {
    return vars
  }
  vars.SUPABASE_ACCESS_TOKEN = await askSecret('SUPABASE_ACCESS_TOKEN')
  vars.SUPABASE_ORG_SLUG = await askSecret('SUPABASE_ORG_SLUG')
  vars.SUPABASE_PROVISION_REGION = await ask('SUPABASE_PROVISION_REGION', 'eu-west-1')
  return vars
}

async function configureOptionalOAuth(vars, mode) {
  if (!(await askYesNo('¿Configurar OAuth (GitHub/Figma/Vercel)?', false))) return vars

  vars.INTEGRATIONS_ENCRYPTION_KEY = await askSecret(
    'INTEGRATIONS_ENCRYPTION_KEY (cadena aleatoria larga para cifrar tokens)',
  )
  vars.GITHUB_OAUTH_CLIENT_ID = await askSecret('GITHUB_OAUTH_CLIENT_ID', true)
  vars.GITHUB_OAUTH_CLIENT_SECRET = await askSecret('GITHUB_OAUTH_CLIENT_SECRET', true)
  vars.FIGMA_OAUTH_CLIENT_ID = await askSecret('FIGMA_OAUTH_CLIENT_ID', true)
  vars.FIGMA_OAUTH_CLIENT_SECRET = await askSecret('FIGMA_OAUTH_CLIENT_SECRET', true)

  if (mode === 'production') {
    vars.VERCEL_INTEGRATION_CLIENT_ID = await askSecret('VERCEL_INTEGRATION_CLIENT_ID', true)
    vars.VERCEL_INTEGRATION_CLIENT_SECRET = await askSecret('VERCEL_INTEGRATION_CLIENT_SECRET', true)
    vars.VERCEL_INTEGRATION_SLUG = await askSecret('VERCEL_INTEGRATION_SLUG', true)
  }
  return vars
}

function checkPrerequisites() {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor < 20) {
    throw new Error('Se requiere Node.js 20 o superior')
  }

  if (!commandExists('pnpm')) {
    log('\npnpm no encontrado. Intentando activar con corepack…')
    run('corepack', ['enable'], { allowFail: true })
    if (!commandExists('pnpm')) {
      throw new Error('Instala pnpm: https://pnpm.io/installation')
    }
  }
}

async function main() {
  log('╔══════════════════════════════════════════╗')
  log('║   Instalador Runlabs42 / Spec-Kit Web    ║')
  log('╚══════════════════════════════════════════╝\n')

  let mergeExisting = false
  if (existsSync(envPath)) {
    const action = await askChoice('Ya existe .env.local. ¿Qué quieres hacer?', [
      { value: 'merge', label: 'Fusionar (conservar valores actuales y añadir/actualizar los nuevos)' },
      { value: 'overwrite', label: 'Sobrescribir por completo' },
      { value: 'cancel', label: 'Cancelar instalación' },
    ])
    if (action === 'cancel') {
      log('Instalación cancelada.')
      return
    }
    mergeExisting = action === 'merge'
  }

  const mode = await askChoice('¿Dónde quieres ejecutar el proyecto?', [
    { value: 'local', label: 'Local — Supabase en Docker (desarrollo)' },
    { value: 'production', label: 'Producción — Supabase en la nube / Vercel' },
  ])

  checkPrerequisites()

  log('\nInstalando dependencias (pnpm install)…')
  run('pnpm', ['install'])

  let vars = mode === 'local' ? await setupLocalBase() : await setupProductionBase()

  if (mergeExisting) {
    vars = { ...parseEnvFile(readFileSync(envPath, 'utf8')), ...vars }
  }

  vars = await configureAI(vars)
  vars = await configureAdminEmails(vars)
  vars = await configureOptionalIntegrations(vars, mode)
  vars = await configureOptionalOAuth(vars, mode)
  vars = await configureContact(vars)
  vars = await configureStitch(vars)
  vars = await configureBlob(vars)
  vars = await configureSupabaseProvision(vars, mode)

  writeFileSync(envPath, buildEnvFile(vars), 'utf8')
  log(`\n✓ Archivo creado: ${envPath}`)

  if (mode === 'local') {
    log('\nSupabase Studio: http://127.0.0.1:54323')
    log('API local:       http://127.0.0.1:54321')
    log('App local:       http://localhost:3010')
  } else {
    log('\nSiguiente paso en producción:')
    log('  1. Sube las variables de .env.local a Vercel (Settings → Environment Variables)')
    log('  2. Ejecuta: pnpm build && pnpm start  (o despliega con Vercel)')
  }

  log('\nComprobaciones útiles:')
  log('  pnpm run check:vertex')
  log('  curl http://localhost:3010/api/health')

  const startNow =
    mode === 'local' && (await askYesNo('¿Arrancar el servidor de desarrollo ahora (`pnpm dev`)?', true))
  if (startNow) {
    log('\nArrancando en http://localhost:3010 …\n')
    run('pnpm', ['dev'])
  } else {
    log('\nSiguiente paso: pnpm dev')
  }
}

main()
  .catch((err) => {
    log(`\n✗ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
  .finally(() => {
    rl.close()
  })
