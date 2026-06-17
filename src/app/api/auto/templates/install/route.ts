import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
export const runtime = 'nodejs'

import { jsonError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { setupTemplateStacks } from '@/lib/auto/templates/setupTemplateStacks'

export async function POST() {
  try {
    await requireStreamUser()
    const workspaceRoot = process.cwd()
    const out = await setupTemplateStacks(workspaceRoot)
    return NextResponse.json({
      ok: true,
      ...out,
    })
  } catch (e) {
    return jsonError(e)
  }
}
