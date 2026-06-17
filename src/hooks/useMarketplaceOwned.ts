'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEMO_EVENT } from '@/lib/auth/demo'
import { loadOwnedMarketplaceProductIds } from '@/lib/marketplace/acquireTemplate'
import { useUser } from '@/hooks/useUser'

export function useMarketplaceOwned() {
  const { isAuthenticated, profile } = useUser()
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => new Set())

  const refreshOwned = useCallback(async () => {
    if (!isAuthenticated) {
      setOwnedIds(new Set())
      return
    }
    const ids = await loadOwnedMarketplaceProductIds(profile)
    setOwnedIds(ids)
  }, [isAuthenticated, profile])

  useEffect(() => {
    refreshOwned()
    const onDemoChange = () => refreshOwned()
    window.addEventListener(DEMO_EVENT, onDemoChange)
    return () => window.removeEventListener(DEMO_EVENT, onDemoChange)
  }, [refreshOwned])

  const isOwned = useCallback((productId: string | null | undefined) => {
    if (!productId) return false
    return ownedIds.has(productId)
  }, [ownedIds])

  return { ownedIds, isOwned, refreshOwned }
}
