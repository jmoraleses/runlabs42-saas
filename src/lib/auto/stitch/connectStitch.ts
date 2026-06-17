import 'server-only'

import { getStitchAccountEmail, checkStitchConnection, isStitchConfigured } from '@/lib/auto/stitch/stitchStatus'
import { listStitchProjectsViaPlaywright } from '@/lib/auto/stitch/listStitchProjectsViaPlaywright'

export type StitchConnectResult = {
  ok: boolean
  configured: boolean
  message: string
  accountEmail?: string | null
  testProjectId?: string
}

export async function connectStitch(opts?: {
  validateProjectId?: string
}): Promise<StitchConnectResult> {
  const accountEmail = await getStitchAccountEmail()
  const configured = await isStitchConfigured()
  if (!configured) {
    return {
      ok: false,
      configured: false,
      message: 'Ejecuta pnpm stitch:auth para guardar la sesión de Stitch (Playwright).',
      accountEmail,
    }
  }

  const ping = await checkStitchConnection()
  if (!ping.ok) {
    return {
      ok: false,
      configured: true,
      message: ping.message,
      accountEmail: ping.accountEmail ?? accountEmail,
    }
  }

  const projectId = opts?.validateProjectId?.trim()
  if (projectId) {
    try {
      const projects = await listStitchProjectsViaPlaywright(200)
      const found = projects.some((p) => p.projectId === projectId)
      return {
        ok: found,
        configured: true,
        message: found
          ? `Proyecto Stitch ${projectId} visible en la web`
          : `No se encontró el proyecto ${projectId} en la UI de Stitch`,
        accountEmail: ping.accountEmail ?? accountEmail,
        testProjectId: found ? projectId : undefined,
      }
    } catch (e) {
      return {
        ok: false,
        configured: true,
        message: e instanceof Error ? e.message : 'No se pudo listar proyectos en Stitch web',
        accountEmail: ping.accountEmail ?? accountEmail,
      }
    }
  }

  return {
    ok: true,
    configured: true,
    message: ping.message,
    accountEmail: ping.accountEmail ?? accountEmail,
  }
}
