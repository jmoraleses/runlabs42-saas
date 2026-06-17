import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureSchema, sql } from '@/lib/db'

const bodySchema = z.record(z.union([z.string(), z.number(), z.boolean()]))

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params
  try {
    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (process.env.POSTGRES_URL) {
      await ensureSchema()
      await sql`
        INSERT INTO contact_messages (form_id, payload)
        VALUES (${formId}, ${JSON.stringify(parsed.data)}::jsonb)
      `
      return NextResponse.json({ ok: true, stored: true })
    }

    if (process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: process.env.CONTACT_TO_EMAIL,
          subject: `Formulario ${formId}`,
          text: JSON.stringify(parsed.data, null, 2),
        }),
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Email failed' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, emailed: true })
    }

    return NextResponse.json(
      { error: 'Configure POSTGRES_URL or RESEND_API_KEY + CONTACT_TO_EMAIL on Vercel' },
      { status: 503 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 },
    )
  }
}
