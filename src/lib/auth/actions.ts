'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/signin')
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return { error: 'Email is required' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/reset/confirm`,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/')
}
