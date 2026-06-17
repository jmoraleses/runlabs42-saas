import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { isDemoProjectId } from '@/lib/auth/demo-server'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { mapIntegrationStatus } from '@/lib/integrations/status'
import type { UserIntegrationRow } from '@/lib/integrations/types'

export async function GET() {
  try {
    const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)
    if (demoCookie && isDemoStreamAllowed()) {
      return NextResponse.json({ integrations: mapIntegrationStatus(null) })
    }

    const { supabase, user } = await requireUser()
    const { data } = await supabase.from('user_integrations').select('*').eq('user_id', user.id).maybeSingle()
    return NextResponse.json({ integrations: mapIntegrationStatus(data as UserIntegrationRow | null) })
  } catch (e) {
    return jsonError(e)
  }
}
