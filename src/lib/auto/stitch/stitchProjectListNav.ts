import 'server-only'

import type { Page } from 'playwright'
import {
  isStitchSharedListItem,
  parseStitchProjectListTitle,
} from '@/lib/auto/stitch/parseStitchProjectListTitle'
import {
  extractStitchProjectIdFromUrl,
  safeStitchGoto,
  stitchAppFrame,
} from '@/lib/auto/stitch/stitchPlaywright.shared'

export type StitchSidebarListRow = {
  title: string
  projectId: string | null
  thumbnailUrl?: string | null
  thumbnailDataUrl?: string | null
}

export async function ensureMisProyectosTab(page: Page): Promise<void> {
  const frame = stitchAppFrame(page)
  const tab = frame.getByRole('radio', { name: /^Mis proyectos$/i }).first()
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    const checked = await tab.isChecked().catch(() => false)
    if (!checked) await tab.click({ timeout: 10_000 })
  }
  await page.waitForTimeout(800)
}

export async function scrollStitchProjectSidebar(page: Page): Promise<void> {
  const frame = stitchAppFrame(page)
  for (let i = 0; i < 14; i++) {
    const scrolled = await frame
      .locator('li[role="button"]')
      .first()
      .evaluate((el) => {
        let parent: HTMLElement | null = el.parentElement
        while (parent) {
          if (parent.scrollHeight > parent.clientHeight + 24) {
            const before = parent.scrollTop
            parent.scrollTop += Math.max(160, parent.clientHeight * 0.9)
            return parent.scrollTop > before
          }
          parent = parent.parentElement
        }
        return false
      })
      .catch(() => false)
    if (!scrolled) break
    await page.waitForTimeout(350)
  }
}

/** Lee la lista lateral «Mis proyectos» sin abrir ningún proyecto. */
export async function collectStitchSidebarProjectRows(page: Page): Promise<StitchSidebarListRow[]> {
  const frame = stitchAppFrame(page)
  const rawRows = await frame.locator('li[role="button"]').evaluateAll((els) =>
    els.map((el) => {
      const raw = (el.textContent || '').trim()
      const anchor =
        el.closest('a[href]') ?? el.querySelector('a[href]')
      let href = anchor instanceof HTMLAnchorElement ? anchor.href : null
      if (!href) {
        for (const attr of ['data-project-id', 'data-id', 'data-href', 'href']) {
          const value = el.getAttribute(attr)
          if (value) {
            href = value
            break
          }
        }
      }
      const match = (href || '').match(/\/projects?\/(\d{5,})/i)
      const img = el.querySelector('img')
      const thumbnailUrl =
        img instanceof HTMLImageElement
          ? (img.currentSrc || img.src || '').trim() || null
          : null
      let thumbnailDataUrl: string | null = null
      if (img instanceof HTMLImageElement) {
        try {
          const w = Math.max(1, img.naturalWidth || img.width || 0)
          const h = Math.max(1, img.naturalHeight || img.height || 0)
          if (w > 0 && h > 0) {
            const canvas = document.createElement('canvas')
            canvas.width = Math.min(240, w)
            canvas.height = Math.min(160, h)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.72)
            }
          }
        } catch {
          thumbnailDataUrl = null
        }
      }
      return { raw, projectId: match?.[1] ?? null, thumbnailUrl, thumbnailDataUrl }
    }),
  )

  const rows: StitchSidebarListRow[] = []
  const seenTitles = new Set<string>()
  for (const row of rawRows) {
    if (isStitchSharedListItem(row.raw)) continue
    const title = parseStitchProjectListTitle(row.raw)
    if (!title || seenTitles.has(title)) continue
    seenTitles.add(title)
    rows.push({
      title,
      projectId: row.projectId,
      thumbnailUrl: row.thumbnailUrl ?? null,
      thumbnailDataUrl: row.thumbnailDataUrl ?? null,
    })
  }
  return rows
}

/**
 * Abre un proyecto desde la lista lateral (solo para exportar/descargar).
 * Devuelve el ID numérico extraído de la URL tras entrar al proyecto.
 */
export async function openStitchProjectByListTitle(
  page: Page,
  title: string,
): Promise<string | null> {
  const trimmed = title.trim()
  if (!trimmed) return null

  await safeStitchGoto(page, '/')
  await ensureMisProyectosTab(page)
  await scrollStitchProjectSidebar(page)
  await page.waitForTimeout(2500)

  const frame = stitchAppFrame(page)
  const listItems = frame.locator('li[role="button"]')
  let listCount = 0
  for (let i = 0; i < 24; i++) {
    listCount = await listItems.count().catch(() => 0)
    if (listCount > 0) break
    await page.waitForTimeout(800)
    if (i === 10) await scrollStitchProjectSidebar(page)
  }
  if (listCount === 0) return null

  const needle = trimmed.toLowerCase()
  const rawTitles = await listItems.evaluateAll((els) =>
    els.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  )
  const matchedIndex = rawTitles.findIndex((raw) => {
    const lower = raw.toLowerCase()
    return lower.includes(needle) || needle.includes(lower.slice(0, Math.min(lower.length, needle.length + 8)))
  })

  const item =
    matchedIndex >= 0 ? listItems.nth(matchedIndex) : listItems.filter({ hasText: trimmed }).first()

  if (!(await item.isVisible({ timeout: 12_000 }).catch(() => false))) return null

  await item.click({ timeout: 15_000 })
  await page.waitForTimeout(2500)

  for (const frameHandle of page.frames()) {
    const id = extractStitchProjectIdFromUrl(frameHandle.url())
    if (id) return id
  }
  return extractStitchProjectIdFromUrl(page.url())
}
