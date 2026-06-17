export type VercelUserInfo = {
  id: string
  username: string
  defaultTeamId?: string
}

export async function validateVercelToken(token: string): Promise<{ ok: boolean; user?: VercelUserInfo; message?: string }> {
  try {
    const res = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, message: body || `Vercel API ${res.status}` }
    }
    const data = (await res.json()) as { user: { id: string; username: string; defaultTeamId?: string } }
    return {
      ok: true,
      user: {
        id: data.user.id,
        username: data.user.username,
        defaultTeamId: data.user.defaultTeamId,
      },
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' }
  }
}
