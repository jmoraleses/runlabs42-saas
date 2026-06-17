import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'

/** Token de GitHub: integración OAuth guardada o sesión Supabase (login con GitHub). */
export async function getGithubAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ token: string; login: string | null } | null> {
  const { data: row } = await supabase
    .from('user_integrations')
    .select('github_access_token_enc, github_login')
    .eq('user_id', userId)
    .maybeSingle()

  const integration = row as Pick<
    UserIntegrationRow,
    'github_access_token_enc' | 'github_login'
  > | null

  if (integration?.github_access_token_enc) {
    return {
      token: decryptSecret(integration.github_access_token_enc),
      login: integration.github_login,
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.provider_token) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const providers = user?.app_metadata?.providers as string[] | undefined
    const hasGithub =
      user?.app_metadata?.provider === 'github' || providers?.includes('github')
    if (hasGithub) {
      return {
        token: session.provider_token,
        login:
          (user?.user_metadata?.user_name as string | undefined) ||
          (user?.user_metadata?.preferred_username as string | undefined) ||
          null,
      }
    }
  }

  return null
}

export function isGithubConnected(row: UserIntegrationRow | null): boolean {
  return !!row?.github_access_token_enc
}
