import type { IntegrationStatus, UserIntegrationRow } from './types'
import { isFigmaOAuthConfigured } from './figmaOAuth'
import { isGithubOAuthConfigured } from './githubOAuth'

export function mapIntegrationStatus(row: UserIntegrationRow | null): IntegrationStatus {
  const vercelConnected = !!row?.vercel_access_token_enc
  const githubConnected = !!row?.github_access_token_enc
  const figmaConnected = !!row?.figma_access_token_enc
  return {
    supabase: {
      connected: false,
      projectRef: null,
      url: null,
      connectedAt: null,
    },
    github: {
      connected: githubConnected,
      login: row?.github_login ?? null,
      connectedAt: row?.github_connected_at ?? null,
      oauthConfigured: isGithubOAuthConfigured(),
    },
    vercel: {
      connected: vercelConnected,
      teamId: row?.vercel_team_id ?? null,
      connectedAt: row?.vercel_connected_at ?? null,
    },
    figma: {
      connected: figmaConnected,
      userId: row?.figma_user_id ?? null,
      connectedAt: row?.figma_connected_at ?? null,
      oauthConfigured: isFigmaOAuthConfigured(),
    },
    ready: true,
  }
}
