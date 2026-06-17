const DEFAULT_TO = 'runlabs42@gmail.com'

export type ContactEmailPayload = {
  name: string
  email: string
  company?: string
  message: string
  topic?: string
}

export type SendContactResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'provider_error'; detail?: string }

export function buildMailtoUrl(payload: ContactEmailPayload): string {
  const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO
  const subject = encodeURIComponent(
    payload.topic === 'enterprise'
      ? `[Runlabs42 Enterprise] ${payload.name}`
      : `[Runlabs42 Contact] ${payload.name}`,
  )
  const body = encodeURIComponent(
    [
      `Nombre: ${payload.name}`,
      `Email: ${payload.email}`,
      payload.company ? `Empresa: ${payload.company}` : null,
      payload.topic ? `Asunto: ${payload.topic}` : null,
      '',
      payload.message,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}

export async function sendContactEmail(payload: ContactEmailPayload): Promise<SendContactResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'not_configured' }
  }

  const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO
  const from =
    process.env.CONTACT_FROM_EMAIL ?? 'Runlabs42 <onboarding@resend.dev>'

  const subject =
    payload.topic === 'enterprise'
      ? `Enterprise — ${payload.name}`
      : `Contacto — ${payload.name}`

  const text = [
    `Nombre: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.company ? `Empresa: ${payload.company}` : null,
    payload.topic ? `Tema: ${payload.topic}` : null,
    '',
    payload.message,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: payload.email,
      subject,
      text,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, reason: 'provider_error', detail }
  }

  return { ok: true }
}
