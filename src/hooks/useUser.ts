'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { apiFetch } from '@/lib/api/client'
import {
  DEMO_USER,
  DEMO_EVENT,
  isDemoActive,
  resolveDemoProfile,
  shouldAutoEnableLocalDemo,
} from '@/lib/auth/demo'
import type { User as AuthUser } from '@supabase/supabase-js'

const GUEST_MODE = process.env.NEXT_PUBLIC_GUEST_MODE === '1'

export type UserProfile = {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  username: string | null
  plan: string
  credits: number
  creditsRenewedAt: string | null
  settings: Record<string, unknown>
  subscriptionStatus: string | null
  subscriptionPeriodEnd: string | null
  stripeSubscriptionId: string | null
  hasStripeCustomer: boolean
}

type CreditsResponse = {
  credits: number
  plan: string
  renewedAt: string | null
}

/* ─────────────────────────────────────────────────────────────
   SINGLETON GLOBAL
   Un único estado de auth compartido por TODOS los componentes
   que llaman a useUser(). Se inicializa una sola vez.
───────────────────────────────────────────────────────────── */
type AuthState = {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

/** Lee la sesión de localStorage sin red — devuelve el usuario o null */
function readCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const ref = url.replace('https://', '').split('.')[0]
    if (!ref) return null

    // Supabase v2 puede guardar la clave con o sin codificación base64
    for (const key of [`sb-${ref}-auth-token`, `sb-${ref}-auth-token-code-verifier`]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      // Intentar como JSON plano
      try {
        const parsed = JSON.parse(raw) as { user?: AuthUser; expires_at?: number } | null
        if (parsed?.user) {
          if (parsed.expires_at && Date.now() / 1000 > parsed.expires_at) return null
          return parsed.user
        }
      } catch { /* no era JSON plano */ }
    }
    return null
  } catch {
    return null
  }
}

const initialUser = readCachedUser()

let globalState: AuthState = {
  user: initialUser,
  profile: null,
  loading: !initialUser,   // si tenemos caché, no cargamos
  error: null,
}

const listeners = new Set<() => void>()
let refreshGen = 0
let profileFetchedFor: string | null = null
let authListenerStarted = false

const SERVER_AUTH_SNAPSHOT: AuthState = {
  user: null,
  profile: null,
  loading: true,
  error: null,
}

function getSnapshot(): AuthState { return globalState }
function getServerSnapshot(): AuthState {
  return SERVER_AUTH_SNAPSHOT
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function emit(update: Partial<AuthState>) {
  globalState = { ...globalState, ...update }
  listeners.forEach((fn) => fn())
}

async function refreshProfile() {
  const gen = ++refreshGen

  if (!isSupabaseConfigured()) {
    if (GUEST_MODE) emit({ user: DEMO_USER, profile: resolveDemoProfile(), loading: false })
    else emit({ user: null, profile: null, loading: false })
    return
  }

  const supabase = createClient()
  if (!supabase) {
    if (GUEST_MODE) emit({ user: DEMO_USER, profile: resolveDemoProfile(), loading: false })
    else emit({ user: null, profile: null, loading: false })
    return
  }

  // Verificar token con el servidor (detecta sesiones expiradas/revocadas)
  const { data: { user } } = await supabase.auth.getUser()
  if (gen !== refreshGen) return

  if (!user) {
    if (isDemoActive() || GUEST_MODE) {
      emit({ user: DEMO_USER, profile: resolveDemoProfile(), loading: false })
    } else {
      emit({ user: null, profile: null, loading: false })
      profileFetchedFor = null
    }
    return
  }

  if (isDemoActive() && (user.id === DEMO_USER.id || user.email === DEMO_USER.email)) {
    emit({ user: DEMO_USER, profile: resolveDemoProfile(), loading: false })
    profileFetchedFor = DEMO_USER.id
    return
  }

  // Usuario verificado — marcar como no cargando aunque el perfil tarde
  emit({ user, loading: false })

  // Evitar re-fetch de perfil si ya lo tenemos
  if (profileFetchedFor === user.id) return
  profileFetchedFor = user.id

  const { data: row } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, bio, username, plan, credits, credits_renewed_at, settings, subscription_status, subscription_period_end, stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (gen !== refreshGen) return

  if (row) {
    emit({
      profile: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        username: row.username,
        plan: row.plan,
        credits: row.credits,
        creditsRenewedAt: row.credits_renewed_at,
        settings: (row.settings as Record<string, unknown>) ?? {},
        subscriptionStatus: row.subscription_status ?? null,
        subscriptionPeriodEnd: row.subscription_period_end ?? null,
        stripeSubscriptionId: row.stripe_subscription_id ?? null,
        hasStripeCustomer: !!row.stripe_customer_id,
      },
    })
  } else {
    try {
      const credits = await apiFetch<CreditsResponse>('/api/user/credits')
      if (gen !== refreshGen) return
      emit({
        profile: {
          id: user.id,
          email: user.email ?? '',
          fullName: null,
          avatarUrl: null,
          bio: null,
          username: null,
          plan: credits.plan,
          credits: credits.credits,
          creditsRenewedAt: credits.renewedAt,
          settings: {},
          subscriptionStatus: null,
          subscriptionPeriodEnd: null,
          stripeSubscriptionId: null,
          hasStripeCustomer: false,
        },
      })
    } catch {
      if (gen !== refreshGen) return
      if (isDemoActive() || shouldAutoEnableLocalDemo()) {
        emit({ user: DEMO_USER, profile: resolveDemoProfile(), loading: false, error: null })
        profileFetchedFor = DEMO_USER.id
      } else {
        emit({ error: 'Failed to load profile' })
      }
    }
  }
}

/** Arranca el listener de auth una sola vez para toda la app */
function startAuthListener() {
  if (authListenerStarted || !isSupabaseConfigured()) return
  const supabase = createClient()
  if (!supabase) return
  authListenerStarted = true

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // Único evento que debe borrar al usuario
      profileFetchedFor = null
      emit({ user: null, profile: null, loading: false, error: null })
    } else if (session?.user) {
      // SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION con sesión válida
      emit({ user: session.user, loading: false })
      void refreshProfile()
    }
    // INITIAL_SESSION con session=null → ignorar para no hacer flash
  })

  // Re-fetch profile (credits, plan) when user returns to the tab
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && globalState.user) {
        profileFetchedFor = null   // force re-fetch so credits update
        void refreshProfile()
      }
    })
  }
}

/* ─────────────────────────────────────────────────────────────
   HOOK PÚBLICO
───────────────────────────────────────────────────────────── */
export function useUser() {
  // useSyncExternalStore garantiza consistencia entre server y client
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const refresh = useCallback(() => {
    profileFetchedFor = null
    void refreshProfile()
  }, [])

  useEffect(() => {
    startAuthListener()
    const onDemoChange = () => {
      profileFetchedFor = null
      void refreshProfile()
    }
    window.addEventListener(DEMO_EVENT, onDemoChange)
    // Si todavía cargando (sin caché) o perfil no cargado, disparar refresh
    if (state.loading || (state.user && !state.profile)) {
      void refreshProfile()
    }
    return () => window.removeEventListener(DEMO_EVENT, onDemoChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    refresh,
    isAuthenticated: !!state.user,
  }
}
