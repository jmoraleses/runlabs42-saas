import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { jsonError } from '@/lib/api/errors'
import { summarizeChatText } from '@/lib/ai/chatInsight.server'

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = await request.json()
    const text = String(body.text ?? '').trim()
    if (!text) return NextResponse.json({ summary: '' })

    const maxChars = Number(body.maxChars)
    const summary = await summarizeChatText(text, {
      maxChars: Number.isFinite(maxChars) ? maxChars : 200,
    })
    return NextResponse.json({ summary })
  } catch (e) {
    return jsonError(e)
  }
}
