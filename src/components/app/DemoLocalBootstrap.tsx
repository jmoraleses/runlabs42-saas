'use client'

import { useEffect } from 'react'
import { bootstrapLocalDemoIfNeeded, isDemoActive } from '@/lib/auth/demo'
import { ensureDemoSeedData } from '@/lib/auth/demo-seed'

/** En desarrollo local activa la cuenta demo si no hay sesión Supabase. */
export function DemoLocalBootstrap() {
  useEffect(() => {
    bootstrapLocalDemoIfNeeded()
    if (isDemoActive()) ensureDemoSeedData()
  }, [])
  return null
}
