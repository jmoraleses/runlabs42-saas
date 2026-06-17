import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { validateProjectForWebDeploy } from '@/lib/mobile/validateDeploy'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)
    const store = requireProjectFilesStore(supabase, user.id, id)
    const files = (await store.list()).map((f) => ({ path: f.path, content: f.content }))
    const validation = validateProjectForWebDeploy(files)
    return NextResponse.json(validation)
  } catch (e) {
    return jsonError(e)
  }
}
