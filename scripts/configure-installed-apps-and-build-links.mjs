#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

function envOrDefault(name, fallback) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : fallback
}

const apps = [
  {
    id: 'wordpress',
    name: 'WordPress',
    url: 'http://localhost:8080',
    adminUrl: 'http://localhost:8080/wp-admin',
    credentials: {
      user: envOrDefault('WORDPRESS_ADMIN_USER', 'admin'),
      pass: envOrDefault('WORDPRESS_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'joomla',
    name: 'Joomla',
    url: 'http://localhost:8082',
    adminUrl: 'http://localhost:8082/administrator',
    credentials: {
      user: envOrDefault('JOOMLA_ADMIN_USER', 'admin'),
      pass: envOrDefault('JOOMLA_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'drupal',
    name: 'Drupal',
    url: 'http://localhost:8083',
    adminUrl: 'http://localhost:8083/user/login',
    credentials: {
      user: envOrDefault('DRUPAL_ADMIN_USER', 'admin'),
      pass: envOrDefault('DRUPAL_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'moodle',
    name: 'Moodle',
    url: 'http://localhost:8084',
    adminUrl: 'http://localhost:8084/login/index.php',
    credentials: {
      user: envOrDefault('MOODLE_ADMIN_USER', 'admin'),
      pass: envOrDefault('MOODLE_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    url: 'http://localhost:8085',
    adminUrl: 'http://localhost:8085/admin-dev',
    credentials: {
      user: envOrDefault('PRESTASHOP_ADMIN_USER', 'admin'),
      pass: envOrDefault('PRESTASHOP_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'opencart',
    name: 'OpenCart',
    url: 'http://localhost:8086',
    adminUrl: 'http://localhost:8086/admin',
    credentials: {
      user: envOrDefault('OPENCART_ADMIN_USER', 'admin'),
      pass: envOrDefault('OPENCART_ADMIN_PASS', 'change-me'),
    },
  },
  {
    id: 'magento',
    name: 'Magento',
    url: 'http://127.0.0.1:8087',
    adminUrl: 'http://127.0.0.1:8087/index.php/admin',
    credentials: {
      user: envOrDefault('MAGENTO_ADMIN_USER', 'admin'),
      pass: envOrDefault('MAGENTO_ADMIN_PASS', 'change-me'),
    },
  },
]

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function run() {
  const workspaceRoot = process.cwd()
  const outputRoot = path.join(workspaceRoot, 'spec', 'template-stack-installers')
  const reportPath = path.join(outputRoot, 'playwright-config-report.json')
  const portalDir = path.join(outputRoot, 'portal')
  const portalPath = path.join(portalDir, 'index.html')

  await ensureDir(outputRoot)
  await ensureDir(portalDir)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const report = []

  for (const app of apps) {
    const row = {
      id: app.id,
      name: app.name,
      url: app.url,
      adminUrl: app.adminUrl ?? null,
      ok: false,
      status: null,
      finalUrl: null,
      title: null,
      notes: [],
    }
    try {
      const res = await page.goto(app.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      row.status = res ? res.status() : null
      row.finalUrl = page.url()
      row.title = await page.title()
      row.ok = row.status !== null && row.status < 500

      // Configuracion real con Playwright para WordPress (login admin)
      if (app.id === 'wordpress' && app.credentials) {
        await page.goto(app.adminUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (page.url().includes('wp-login.php')) {
          await page.fill('#user_login', app.credentials.user)
          await page.fill('#user_pass', app.credentials.pass)
          await page.click('#wp-submit')
          await page.waitForLoadState('domcontentloaded')
        }
        row.notes.push(
          page.url().includes('/wp-admin')
            ? 'Login admin WordPress validado con Playwright.'
            : 'No se pudo confirmar login admin en WordPress.',
        )
      }

      if (app.id === 'magento' && app.adminUrl) {
        const adminRes = await page.goto(app.adminUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        const adminStatus = adminRes ? adminRes.status() : null
        row.notes.push(`Magento admin (${app.adminUrl}) estado: ${adminStatus ?? 'n/a'}.`)
      }
    } catch (error) {
      row.ok = false
      row.notes.push(`Error Playwright: ${error instanceof Error ? error.message : String(error)}`)
    }
    report.push(row)
  }

  await browser.close()

  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        apps: report,
      },
      null,
      2,
    ),
    'utf8',
  )

  const cards = report
    .map((row) => {
      const badge = row.ok ? 'OK' : 'ERROR'
      const badgeClass = row.ok ? 'ok' : 'error'
      const noteList = row.notes.length
        ? `<ul>${row.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
        : '<p>Sin notas.</p>'
      const appCreds = apps.find((a) => a.id === row.id)?.credentials
      const creds = appCreds
        ? `<p><strong>Admin:</strong> ${esc(appCreds.user)}</p><p><strong>Password:</strong> ${esc(appCreds.pass)}</p>`
        : '<p><strong>Admin:</strong> n/a</p><p><strong>Password:</strong> n/a</p>'
      return `
<article class="card">
  <div class="head">
    <h2>${esc(row.name)}</h2>
    <span class="badge ${badgeClass}">${badge}</span>
  </div>
  <p><strong>URL:</strong> <a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.url)}</a></p>
  <p><strong>URL panel admin:</strong> ${row.adminUrl ? `<a href="${esc(row.adminUrl)}" target="_blank" rel="noopener noreferrer">${esc(row.adminUrl)}</a>` : 'n/a'}</p>
  <p><strong>Estado HTTP:</strong> ${esc(row.status ?? 'n/a')}</p>
  <p><strong>Final URL:</strong> ${esc(row.finalUrl ?? 'n/a')}</p>
  <p><strong>Titulo:</strong> ${esc(row.title ?? 'n/a')}</p>
  ${creds}
  ${noteList}
</article>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hub de aplicaciones instaladas</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0; background:#0b1220; color:#e5e7eb; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 10px; font-size: 28px; }
      .meta { color:#9ca3af; margin-bottom: 20px; }
      .tabs { display:flex; gap:10px; margin: 14px 0 18px; }
      .tab-btn { background:#1f2937; color:#e5e7eb; border:1px solid #374151; border-radius:10px; padding:8px 12px; cursor:pointer; }
      .tab-btn.active { background:#2563eb; border-color:#2563eb; color:#fff; }
      .tab-panel { display:none; }
      .tab-panel.active { display:block; }
      .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .card { border:1px solid #1f2937; border-radius:12px; padding:14px; background:#111827; }
      .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .head h2 { margin:0; font-size:18px; }
      .badge { padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
      .badge.ok { background:#052e16; color:#86efac; border:1px solid #166534; }
      .badge.error { background:#3f0c0c; color:#fecaca; border:1px solid #7f1d1d; }
      a { color:#93c5fd; }
      p { margin:7px 0; font-size:14px; }
      ul { margin:8px 0 0; padding-left:18px; color:#d1d5db; }
      li { margin:4px 0; font-size:13px; }
      .orchestrator-frame { width:100%; min-height:1100px; border:1px solid #1f2937; border-radius:12px; background:#111827; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Hub de aplicaciones instaladas</h1>
      <p class="meta">Generado automáticamente con Playwright. Archivo: <code>spec/template-stack-installers/portal/index.html</code></p>
      <div class="tabs">
        <button class="tab-btn active" data-tab="estado">Estado</button>
        <button class="tab-btn" data-tab="orquestacion">Orquestación multi plataforma</button>
      </div>
      <section id="tab-estado" class="tab-panel active">
        <div class="grid">${cards}</div>
      </section>
      <section id="tab-orquestacion" class="tab-panel">
        <p class="meta">Esta sección usa runtime Next para orquestación masiva (Stitch + conversión + instalación).</p>
        <iframe class="orchestrator-frame" src="http://localhost:3010/portal" title="Orquestación multi plataforma"></iframe>
      </section>
    </div>
    <script>
      const tabs = document.querySelectorAll('.tab-btn');
      const panels = {
        estado: document.getElementById('tab-estado'),
        orquestacion: document.getElementById('tab-orquestacion'),
      };
      for (const btn of tabs) {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          tabs.forEach((x) => x.classList.remove('active'));
          btn.classList.add('active');
          Object.values(panels).forEach((p) => p.classList.remove('active'));
          if (tab && panels[tab]) panels[tab].classList.add('active');
        });
      }
    </script>
  </body>
</html>`

  await fs.writeFile(portalPath, html, 'utf8')
  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath: path.relative(workspaceRoot, reportPath),
        portalPath: path.relative(workspaceRoot, portalPath),
      },
      null,
      2,
    ),
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
