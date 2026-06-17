import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { checkStitchConnection, isStitchConfigured } from '@/lib/auto/stitch/stitchStatus'

export async function GET() {
  try {
    const configured = await isStitchConfigured()
    const connection = configured
      ? await checkStitchConnection()
      : { ok: false, message: 'No configurado', accountEmail: null }
    const tmConfigured = Boolean(
      process.env.TEMPLATEMONSTER_AUTHOR_EMAIL?.trim() &&
        process.env.TEMPLATEMONSTER_AUTHOR_PASSWORD?.trim(),
    )
    return NextResponse.json({
      stitch: { configured, connected: connection.ok, ...connection },
      templateMonster: {
        credentialsConfigured: tmConfigured,
        connected: false,
        message: tmConfigured
          ? 'Pulsa Conectar para validar sesión'
          : 'Modo assist — pulsa Conectar para abrir portal',
        portalUrl: 'https://www.templatemonster.com/',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}
