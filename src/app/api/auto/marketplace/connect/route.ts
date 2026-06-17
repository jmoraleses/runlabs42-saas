import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { connectTemplateMonster } from '@/lib/auto/marketplace/connectTemplateMonster'

export async function POST() {
  try {
    await requireStreamUser()
    const result = await connectTemplateMonster()
    return NextResponse.json(result)
  } catch (e) {
    return jsonError(e)
  }
}
