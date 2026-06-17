import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { mapProject } from '@/lib/db/mappers'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'marketplace-import'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const productId = String(body.productId ?? '')
    if (!productId) throw new ApiError(400, 'productId requerido')

    const { data: purchase } = await supabase
      .from('marketplace_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle()

    if (!purchase) throw new ApiError(403, 'Debes comprar este producto primero')

    const { data: product, error: prodErr } = await supabase
      .from('marketplace_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (prodErr || !product) throw new ApiError(404, 'Producto no encontrado')

    const name = String(body.name ?? product.name).trim() || product.name

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description: product.description,
        framework: product.framework ?? 'next',
        status: 'draft',
        storage_provider: 'platform',
      })
      .select()
      .single()

    if (projErr) throw new ApiError(500, 'No se pudo crear el proyecto')

    const { error: specErr } = await supabase.from('specs').insert({
      project_id: project.id,
      content: `# ${product.name}\n\nImportado desde marketplace.\n\nRepositorio: ${product.github_repo ?? 'N/A'}\n`,
      created_by: user.id,
    })

    if (specErr) {
      await supabase.from('projects').delete().eq('id', project.id)
      throw new ApiError(500, 'No se pudo crear la especificación')
    }

    if (product.github_repo) {
      const store = requireProjectFilesStore(supabase, user.id, project.id)
      await store.put(
        'README.md',
        `# ${product.name}\n\nClonado desde: ${product.github_repo}\n`,
        'markdown',
      )
    }

    return NextResponse.json({ project: mapProject(project) }, { status: 201 })
  } catch (e) {
    return jsonError(e)
  }
}
