import type { SiteManifest, SiteManifestForm } from '@/lib/design/siteManifest'
import { sqlSchemaForSiteType } from '@/lib/publish/sqlSchemas'
import { loadSiteNextTemplate } from '@/lib/publish/loadSiteTemplate'

export type GeneratedFile = { path: string; content: string }

function zodFieldSchema(field: SiteManifestForm['fields'][number]): string {
  const base =
    field.type === 'email'
      ? 'z.string().email()'
      : field.type === 'number'
        ? 'z.coerce.number()'
        : 'z.string()'
  return field.required ? base : `${base}.optional()`
}

function formRouteHandler(form: SiteManifestForm): string {
  const shape = form.fields
    .map((f) => `  ${JSON.stringify(f.name)}: ${zodFieldSchema(f)},`)
    .join('\n')
  return `import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureSchema, sql } from '@/lib/db'

const schema = z.object({
${shape}
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (process.env.POSTGRES_URL) {
      await ensureSchema()
      const formId = ${JSON.stringify(form.id)}
      await sql\`
        INSERT INTO contact_messages (form_id, payload)
        VALUES (\${formId}, \${JSON.stringify(parsed.data)}::jsonb)
      \`
      return NextResponse.json({ ok: true, stored: true })
    }

    if (process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${process.env.RESEND_API_KEY}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: process.env.CONTACT_TO_EMAIL,
          subject: \`[${form.id}] ${form.intent}\`,
          text: JSON.stringify(parsed.data, null, 2),
        }),
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Email failed' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, emailed: true })
    }

    return NextResponse.json(
      { error: 'Configure POSTGRES_URL or RESEND_API_KEY + CONTACT_TO_EMAIL on Vercel' },
      { status: 503 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 },
    )
  }
}
`
}

function pageComponent(pageName: string, pageId: string): string {
  return `'use client'

import Link from 'next/link'
import { useState } from 'react'

const NAV = __NAV_LINKS__

export default function Page() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submitForm(formId: string, form: HTMLFormElement) {
    setStatus('loading')
    setError(null)
    const data = Object.fromEntries(new FormData(form).entries())
    const res = await fetch(\`/api/forms/\${formId}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError((body as { error?: string }).error ?? 'Error al enviar')
      setStatus('error')
      return
    }
    setStatus('ok')
    form.reset()
  }

  return (
    <main data-page-id="${pageId}" style={{ minHeight: '100dvh' }}>
      <nav aria-label="Principal" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>
      <section style={{ padding: '1rem 2rem' }}>
        <h1>${pageName.replace(/'/g, "\\'")}</h1>
        <p>Vista generada — sustituye por componentes del diseño convertido.</p>
        __FORM_HANDLERS__
      </section>
    </main>
  )
}
`
}

function buildNavLinks(manifest: SiteManifest): string {
  return JSON.stringify(
    manifest.pages.map((p) => ({ href: p.route, label: p.name })),
    null,
    2,
  )
}

function buildFormHandlers(manifest: SiteManifest, pageId: string): string {
  const pageForms = manifest.forms.filter((f) => f.pageId === pageId)
  if (!pageForms.length) return ''
  return pageForms
    .map(
      (f) => `
        <form
          data-form-id="${f.id}"
          onSubmit={(e) => {
            e.preventDefault()
            void submitForm('${f.id}', e.currentTarget)
          }}
          style={{ display: 'grid', gap: '0.75rem', maxWidth: 420, marginTop: '1.5rem' }}
        >
          ${f.fields
            .map(
              (field) =>
                `<label>${field.name}<input name="${field.name}" type="${field.type === 'email' ? 'email' : 'text'}" ${field.required ? 'required' : ''} /></label>`,
            )
            .join('\n          ')}
          <button type="submit" disabled={status === 'loading'}>Enviar</button>
          {status === 'ok' ? <p role="status">Enviado correctamente.</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </form>`,
    )
    .join('\n')
}

function routePageFile(manifest: SiteManifest, page: SiteManifest['pages'][number]): GeneratedFile {
  const nav = buildNavLinks(manifest)
  const forms = buildFormHandlers(manifest, page.id)
  let content = pageComponent(page.name, page.id)
  content = content.replace('__NAV_LINKS__', nav).replace('__FORM_HANDLERS__', forms)

  if (page.route === '/') {
    return { path: 'app/page.tsx', content }
  }
  const slug = page.route.replace(/^\//, '')
  return { path: `app/${slug}/page.tsx`, content }
}

function updateDbEnsureSchema(content: string, manifest: SiteManifest): string {
  const schema = sqlSchemaForSiteType(manifest.siteType)
  const extraTables = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('CREATE TABLE') && !s.includes('contact_messages'))
    .map((stmt) => {
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
      const table = match?.[1]
      if (!table) return ''
      return `
  await sql\`
    ${stmt};
  \``
    })
    .filter(Boolean)
    .join('')

  if (!extraTables) return content

  return content.replace(
    'export async function ensureSchema(): Promise<void> {',
    `export async function ensureSchema(): Promise<void> {
${extraTables}`,
  )
}

/** Genera archivos Next.js + API a partir del manifiesto y plantilla base. */
export function generateBackendFromManifest(manifest: SiteManifest): GeneratedFile[] {
  const template = loadSiteNextTemplate()
  const byPath = new Map(template.map((f) => [f.path, f.content]))

  const sql = sqlSchemaForSiteType(manifest.siteType)
  byPath.set('drizzle/0001_init.sql', sql.trim() + '\n')

  if (byPath.has('lib/db.ts')) {
    byPath.set('lib/db.ts', updateDbEnsureSchema(byPath.get('lib/db.ts')!, manifest))
  }

  for (const form of manifest.forms) {
    byPath.set(`app/api/forms/${form.id}/route.ts`, formRouteHandler(form))
  }

  const pageFiles: GeneratedFile[] = []
  for (const page of manifest.pages) {
    pageFiles.push(routePageFile(manifest, page))
  }

  const templateFiles: GeneratedFile[] = [...byPath.entries()].map(([path, content]) => ({
    path,
    content,
  }))

  const pagePaths = new Set(pageFiles.map((f) => f.path))
  return [
    ...templateFiles.filter((f) => !pagePaths.has(f.path)),
    ...pageFiles,
  ]
}

export function mergeGeneratedWithExisting(
  existing: GeneratedFile[],
  generated: GeneratedFile[],
): GeneratedFile[] {
  const map = new Map<string, string>()
  for (const f of existing) map.set(f.path, f.content)
  for (const f of generated) {
    if (f.path.startsWith('app/api/forms/') || f.path.startsWith('drizzle/')) {
      map.set(f.path, f.content)
    } else if (!map.has(f.path) || f.path === 'lib/db.ts' || f.path === 'drizzle/0001_init.sql') {
      map.set(f.path, f.content)
    }
  }
  return [...map.entries()].map(([path, content]) => ({ path, content }))
}
