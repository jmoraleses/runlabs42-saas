import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'

type StoredItem = {
  id: string
  title: string
  prompt: string
  platformIds: string[]
}

const FILE_PATH = path.join(process.cwd(), 'spec', 'template-stack-installers', 'orchestrator-items.json')

async function readItems(): Promise<StoredItem[]> {
  try {
    const raw = await readFile(FILE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as { items?: StoredItem[] }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

async function saveItems(items: StoredItem[]): Promise<void> {
  await mkdir(path.dirname(FILE_PATH), { recursive: true })
  await writeFile(
    FILE_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2),
    'utf8',
  )
}

export async function GET() {
  try {
    await requireStreamUser()
    const items = await readItems()
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = (await request.json().catch(() => ({}))) as { items?: StoredItem[] }
    const items = Array.isArray(body.items) ? body.items : []
    for (const item of items) {
      if (!String(item.id ?? '').trim() || !String(item.title ?? '').trim() || !String(item.prompt ?? '').trim()) {
        throw new ApiError(400, 'items inválidos')
      }
    }
    await saveItems(items)
    return NextResponse.json({ ok: true, total: items.length })
  } catch (e) {
    return jsonError(e)
  }
}
