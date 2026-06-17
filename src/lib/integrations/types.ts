export type IntegrationStatus = {
  supabase: {
    connected: boolean
    projectRef: string | null
    url: string | null
    connectedAt: string | null
  }
  github: {
    connected: boolean
    login: string | null
    connectedAt: string | null
    oauthConfigured: boolean
  }
  vercel: {
    connected: boolean
    teamId: string | null
    connectedAt: string | null
  }
  figma: {
    connected: boolean
    userId: string | null
    connectedAt: string | null
    oauthConfigured: boolean
  }
  ready: boolean
}

export type UserIntegrationRow = {
  user_id: string
  supabase_project_ref: string | null
  supabase_url: string | null
  supabase_anon_key_enc: string | null
  supabase_service_role_enc: string | null
  supabase_connected_at: string | null
  vercel_team_id: string | null
  vercel_access_token_enc: string | null
  vercel_connected_at: string | null
  github_access_token_enc: string | null
  github_login: string | null
  github_connected_at: string | null
  figma_access_token_enc: string | null
  figma_refresh_token_enc: string | null
  figma_user_id: string | null
  figma_connected_at: string | null
}
