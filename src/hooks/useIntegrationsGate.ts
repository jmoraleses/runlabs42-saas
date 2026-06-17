'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, loadDemoIntegrationStatus } from '@/lib/auth/demo'
import type { IntegrationStatus } from '@/lib/integrations/types'

/** Ya no bloquea el editor; solo expone estado de integraciones (p. ej. Vercel para deploy). */
export function useIntegrationsGate(_navigate?: (path: string) => void) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    if (isDemoActive()) {
      setStatus(loadDemoIntegrationStatus())
      setLoading(false)
      return
    }
    try {
      const data = await apiFetch<{ integrations: IntegrationStatus }>('/api/integrations/status')
      setStatus(data.integrations)
    } catch {
      setStatus(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    ready: true,
    status,
    loading,
    refresh,
    settingsPath: '/settings?tab=connect',
  }
}
