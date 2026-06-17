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
      const hrefFromNode = (node: Element | null): string | null => {
        if (!node) return null
        const anchor =
          (node.closest('a[href]') as HTMLAnchorElement | null) ??
          (node.querySelector('a[href]') as HTMLAnchorElement | null)
        return anchor?.href ?? null
      }
      let href = hrefFromNode(el)
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
      return { raw, projectId: match?.[1] ?? null }
    }),
  )

  const rows: StitchSidebarListRow[] = []
  const seenTitles = new Set<string>()
  for (const row of rawRows) {
    if (isStitchSharedListItem(row.raw)) continue
    const title = parseStitchProjectListTitle(row.raw)
    if (!title || seenTitles.has(title)) continue
    seenTitles.add(title)
    rows.push({ title, projectId: row.projectId })
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

  const frame = stitchAppFrame(page)
  const item = frame.locator('li[role="button"]').filter({ hasText: trimmed }).first()
  if (!(await item.isVisible({ timeout: 12_000 }).catch(() => false))) return null

  await item.click({ timeout: 15_000 })
  await page.waitForTimeout(2500)

  for (const frameHandle of page.frames()) {
    const id = extractStitchProjectIdFromUrl(frameHandle.url())
    if (id) return id
  }
  return extractStitchProjectIdFromUrl(page.url())
}
