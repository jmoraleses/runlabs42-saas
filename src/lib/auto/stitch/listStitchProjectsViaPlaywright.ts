import 'server-only'

import type { StitchProjectSummary } from '@/lib/design/stitchMcpClient'
import {
  closeStitchSession,
  launchStitchBrowser,
  openStitchPage,
} from '@/lib/auto/stitch/stitchPlaywright.shared'
import {
  collectStitchSidebarProjectRows,
  ensureMisProyectosTab,
  scrollStitchProjectSidebar,
} from '@/lib/auto/stitch/stitchProjectListNav'

/**
 * Lista proyectos visibles en «Mis proyectos» leyendo solo la barra lateral.
 * No entra en cada proyecto; el ID numérico solo se resuelve al descargar.
 */
export async function listStitchProjectsViaPlaywright(
  limit = 200,
): Promise<StitchProjectSummary[]> {
  const bounded = Math.min(Math.max(limit, 1), 500)
  const { browser, context, viaCdp } = await launchStitchBrowser()
  try {
    const page = await openStitchPage(context, '/')
    await ensureMisProyectosTab(page)
    await scrollStitchProjectSidebar(page)
    const rows = (await collectStitchSidebarProjectRows(page)).slice(0, bounded)

    return rows.map((row) => ({
      projectId: row.projectId,
      title: row.title,
      screenCount: null,
      screenCountStatus: 'unavailable' as const,
    }))
  } finally {
    await closeStitchSession({ browser, context, viaCdp })
  }
}
