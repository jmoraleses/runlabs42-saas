'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp, Icon, AppShell } from '@/components/app/shell'
import { SK_LANGS } from '@/lib/i18n'
import { useUser } from '@/hooks/useUser'
import { apiFetch } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { IntegrationsSection } from '@/components/settings/IntegrationsSection'
import { CreditUsagePanel } from '@/components/billing/CreditUsagePanel'
import { CreditPurchaseForm } from '@/components/billing/CreditPurchaseForm'
import { parsePurchaseAmountEur } from '@/lib/stripe/creditPurchase'
import {
  isDemoActive,
  resolveDemoProfile,
  saveDemoProfilePatch,
  shouldUseDemoData,
} from '@/lib/auth/demo'
import { signOut } from '@/lib/auth/client'
import { getPlanCreditLimit } from '@/lib/constants'
import { getPricingPlans } from '@/lib/pricing/plans'
import { hasPaidSubscription } from '@/lib/pricing/subscription'
import { getDemoSubscriptionHistory } from '@/lib/billing/subscriptionHistory'
import { formatT } from '@/lib/i18n'
import {
  isValidUsernameFormat,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
} from '@/lib/user/username'

// Runlabs42 — Settings

function SettingsPageInner() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    const q = searchParams.get("tab");
    if (
      q === "connect" ||
      q === "profile" ||
      q === "billing" ||
      q === "activity" ||
      q === "preferences"
    ) {
      setTab(q);
    }
    if (q === "danger") {
      setTab("profile");
    }
  }, [searchParams]);

  const tabs = [
    { id: "profile", label: t("set.profile"), icon: <Icon.Folder /> },
    { id: "connect", label: t("set.connect"), icon: <Icon.Bolt /> },
    { id: "billing", label: t("set.billing"), icon: <Icon.CreditCard /> },
    { id: "activity", label: t("set.activity"), icon: <Icon.Activity /> },
    { id: "preferences", label: t("set.preferences"), icon: <Icon.Settings /> },
  ];

  return (
    <AppShell>
      <div className="app-page">
        <div className="container settings-page">
        <header className="app-page-header settings-page-head">
          <h1>{t("set.title")}</h1>
          <p className="app-page-header__lead">{t("set.lead")}</p>
        </header>

        <div className="settings-page-body">
          <nav className="settings-tabs" aria-label={t("set.title")}>
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`settings-tab${tab === tb.id ? " is-active" : ""}`}
                onClick={() => {
                  setTab(tb.id)
                  router.replace(`/settings?tab=${tb.id}`, { scroll: false })
                }}
              >
                <span className="settings-tab-icon">{tb.icon}</span>
                {tb.label}
              </button>
            ))}
          </nav>

          <main className="settings-panel">
            {tab === "connect" && (
              <section className="settings-section settings-section--integrations">
                <div className="settings-section-head">
                  <h2 className="settings-section-title">{t("set.connectTitle")}</h2>
                  <p className="settings-section-desc">{t("set.connectDesc")}</p>
                </div>
                <Suspense fallback={<p className="integrations-loading">…</p>}>
                  <IntegrationsSection />
                </Suspense>
              </section>
            )}
            {tab === "profile" && <ProfileSection />}
            {tab === "billing" && <BillingSection />}
            {tab === "activity" && <ActivitySection />}
            {tab === "preferences" && <PreferencesSection lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />}
          </main>
        </div>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, desc, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h2 className="settings-section-title">{title}</h2>
        {desc && <p className="settings-section-desc">{desc}</p>}
      </div>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function DeleteAccountDialog({ open, deleting, error, onCancel, onConfirm }) {
  const { t } = useApp()
  if (!open) return null

  return (
    <div
      className="settings-delete-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        className="settings-delete-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-account-title" className="settings-delete-dialog-title">
          {t('set.deleteConfirmTitle')}
        </h3>
        <p id="delete-account-desc" className="settings-delete-dialog-body settings-delete-dialog-body--dark">
          {t('set.deleteConfirmBody')}
        </p>
        {error ? <p className="settings-delete-dialog-error">{error}</p> : null}
        <div className="settings-delete-dialog-actions">
          <button type="button" className="btn btn-ghost" disabled={deleting} onClick={onCancel}>
            {t('set.deleteConfirmCancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm settings-profile-delete-btn"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? t('set.deleteInProgress') : t('set.deleteConfirmAction')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileSection() {
  const { t } = useApp()
  const { profile, refresh } = useUser()
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('same')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [uploading, setUploading] = useState(false)

  const savedUsername = profile?.username ?? ''

  useEffect(() => {
    setFullName(profile?.fullName ?? '')
    setBio(profile?.bio ?? '')
    setUsernameInput(savedUsername ? `@${savedUsername}` : '')
    setUsernameStatus('same')
  }, [profile, savedUsername])

  const normalizedUsername = normalizeUsername(usernameInput)
  const usernameChanged = normalizedUsername !== savedUsername

  useEffect(() => {
    if (!usernameChanged) {
      setUsernameStatus('same')
      return
    }
    if (!normalizedUsername) {
      setUsernameStatus('invalid')
      return
    }
    if (!isValidUsernameFormat(normalizedUsername)) {
      setUsernameStatus('invalid')
      return
    }

    if (isDemoActive()) {
      setUsernameStatus(normalizedUsername === 'admin' ? 'taken' : 'available')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setUsernameStatus('checking')
      void apiFetch(
        `/api/user/username/check?username=${encodeURIComponent(normalizedUsername)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (res.available) setUsernameStatus('available')
          else if (res.reason === 'invalid') setUsernameStatus('invalid')
          else setUsernameStatus('taken')
        })
        .catch(() => {
          setUsernameStatus('idle')
        })
    }, 400)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedUsername, usernameChanged])

  useEffect(() => {
    if (!saved) return undefined
    const id = window.setTimeout(() => setSaved(false), 2600)
    return () => window.clearTimeout(id)
  }, [saved])

  function canSaveUsername() {
    if (!usernameChanged) return true
    if (!normalizedUsername || !isValidUsernameFormat(normalizedUsername)) return false
    if (usernameStatus === 'checking' || usernameStatus === 'idle') return false
    return usernameStatus === 'available'
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    if (!canSaveUsername()) {
      setSaveError(t('set.usernameSaveBlocked'))
      setSaving(false)
      return
    }

    try {
      const payload = {
        fullName: fullName.trim() || null,
        bio: bio.trim() || null,
        username: normalizedUsername || null,
      }

      if (isDemoActive()) {
        saveDemoProfilePatch(payload)
        await refresh()
        setSaved(true)
        return
      }

      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      await refresh()
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('set.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    setSaveError(null)
    try {
      if (isDemoActive()) {
        const url = URL.createObjectURL(file)
        saveDemoProfilePatch({ avatarUrl: url })
        await refresh()
        return
      }

      if (!isSupabaseConfigured()) {
        throw new Error(t('set.supabaseRequired') || 'Supabase no configurado')
      }
      const supabase = createClient()
      if (!supabase) throw new Error(t('set.supabaseRequired') || 'Supabase no configurado')
      const path = `${profile.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: urlData.publicUrl }),
      })
      await refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('set.saveError'))
    } finally {
      setUploading(false)
    }
  }

  const initials = profile?.fullName?.slice(0, 1) || profile?.email?.slice(0, 1)?.toUpperCase() || 'A'

  return (
    <Section title={t('set.profileTitle')} desc={t('set.profileDesc')}>
      <Row label={t('set.avatar')} hint={t('set.avatarHint')}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: profile?.avatarUrl
                ? `url(${profile.avatarUrl}) center/cover`
                : "linear-gradient(135deg, var(--accent), var(--accent-2))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 600,
              fontSize: 22,
              fontFamily: "var(--font-display)",
            }}
          >
            {!profile?.avatarUrl && initials}
          </div>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            {uploading ? t('set.uploading') : t('set.upload')}
            <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </label>
        </div>
      </Row>
      <Row label={t('set.displayName')}>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </Row>
      <Row
        label={t('set.username')}
        hint={
          usernameStatus === 'available'
            ? t('set.usernameAvailable')
            : usernameStatus === 'taken'
              ? t('set.usernameTaken')
              : usernameStatus === 'invalid'
                ? t('set.usernameInvalid')
                : usernameStatus === 'checking'
                  ? t('set.usernameChecking')
                  : t('set.usernameHint')
        }
      >
        <div className="settings-username-field">
          <input
            className={`input mono settings-username-input${
              usernameStatus === 'taken' || usernameStatus === 'invalid' ? ' is-error' : ''
            }${usernameStatus === 'available' ? ' is-ok' : ''}`}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="@usuario"
            maxLength={USERNAME_MAX_LENGTH + 1}
            style={{ maxWidth: 320 }}
            aria-invalid={usernameStatus === 'taken' || usernameStatus === 'invalid'}
          />
        </div>
      </Row>
      <Row label={t('set.email')}>
        <input className="input" type="email" value={profile?.email ?? ''} readOnly style={{ maxWidth: 320 }} />
      </Row>
      <Row label={t('set.bio')} hint={t('set.bioHint')}>
        <textarea
          className="input"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </Row>
      <div className="settings-card-foot">
        {saveError && (
          <span style={{ fontSize: 13, color: 'var(--danger)', marginRight: 'auto' }}>{saveError}</span>
        )}
        {saved && (
          <span className="settings-save-toast" role="status" aria-live="polite">
            <Icon.Check />
            {t('set.saved')}
          </span>
        )}
        <button
          type="button"
          className="btn btn-accent"
          disabled={saving || !canSaveUsername()}
          onClick={save}
        >
          {saving ? t('set.saving') : t('set.save')}
        </button>
      </div>
    </Section>
  )
}

function DeleteAccountSection() {
  const { t } = useApp()
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  async function confirmDeleteAccount() {
    setDeletingAccount(true)
    setDeleteError(null)
    try {
      if (isDemoActive()) {
        window.localStorage.removeItem('runlabs_demo')
        window.localStorage.removeItem('runlabs_demo_profile')
        window.localStorage.removeItem('runlabs_demo_projects')
        window.localStorage.removeItem('runlabs_demo_project_files')
        window.dispatchEvent(new Event('runlabs:demo-change'))
        await signOut()
        router.push('/')
        return
      }
      await apiFetch('/api/user/account', { method: 'DELETE' })
      await signOut()
      router.push('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('set.deleteError'))
    } finally {
      setDeletingAccount(false)
    }
  }

  return (
    <>
      <DeleteAccountDialog
        open={deleteDialogOpen}
        deleting={deletingAccount}
        error={deleteError}
        onCancel={() => {
          if (deletingAccount) return
          setDeleteDialogOpen(false)
          setDeleteError(null)
        }}
        onConfirm={() => void confirmDeleteAccount()}
      />
      <section className="settings-section">
        <div className="settings-section-head">
          <h2 className="settings-section-title">{t('set.dangerZoneTitle')}</h2>
          <p className="settings-section-desc">{t('set.dangerZoneDesc')}</p>
        </div>
        <div className="settings-card settings-prefs-delete-card">
          <div className="settings-prefs-delete-inner">
            <div className="settings-prefs-delete-copy">
              <h3 className="settings-prefs-delete-title">{t('set.deleteAccount')}</h3>
              <p className="settings-prefs-delete-hint">{t('set.deleteHint')}</p>
            </div>
            <button
              type="button"
              className="btn btn-sm settings-prefs-delete-btn"
              onClick={() => {
                setDeleteError(null)
                setDeleteDialogOpen(true)
              }}
            >
              {t('set.deleteBtn')}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}


function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        background: on ? "var(--accent)" : "var(--surface-3)",
        position: "relative",
        transition: "background 200ms var(--ease)",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 200ms var(--ease)",
        }}
      />
    </button>
  );
}

function BillingActivityChartIcon() {
  return (
    <svg
      className="settings-billing-activity-chart"
      viewBox="0 0 32 32"
      aria-hidden
    >
      <rect className="settings-billing-activity-chart__bar settings-billing-activity-chart__bar--1" x="4" y="18" width="5" height="10" rx="1.5" />
      <rect className="settings-billing-activity-chart__bar settings-billing-activity-chart__bar--2" x="13" y="10" width="5" height="18" rx="1.5" />
      <rect className="settings-billing-activity-chart__bar settings-billing-activity-chart__bar--3" x="22" y="14" width="5" height="14" rx="1.5" />
    </svg>
  );
}

function useSubscriptionHistory() {
  const { profile } = useUser()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    if (shouldUseDemoData(profile)) {
      setEntries(getDemoSubscriptionHistory())
      setLoading(false)
      return () => { cancelled = true }
    }

    apiFetch('/api/subscription/history')
      .then((d) => {
        if (!cancelled) setEntries(d.entries ?? [])
      })
      .catch(() => {
        if (!cancelled) setEntries([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [profile?.id, profile?.plan])

  return { entries, loading }
}

function subscriptionHistoryKindLabel(t, kind) {
  const key = `set.subHistory.kind.${kind}`
  return t(key) || kind
}

function subscriptionHistoryStatusLabel(t, status) {
  const key = `set.subHistory.status.${status}`
  return t(key) || status
}

function formatSubscriptionAmount(entry, locale) {
  if (entry.amountEur == null) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: entry.currency || 'EUR',
  }).format(entry.amountEur)
}

function BillingSection() {
  return (
    <Suspense fallback={<p className="integrations-loading">…</p>}>
      <BillingSectionInner />
    </Suspense>
  )
}

function BillingSectionInner() {
  const { t, navigate } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, refresh: refreshProfile } = useUser()
  const credits = profile?.credits ?? 0
  const plan = profile?.plan ?? 'free'
  const creditTotal = getPlanCreditLimit(plan)
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [subInfo, setSubInfo] = useState(null)

  const planLabel = getPricingPlans(t).find((p) => p.id === plan)?.name ?? plan
  const subStatus = subInfo?.subscriptionStatus ?? profile?.subscriptionStatus ?? 'none'
  const periodEndRaw = subInfo?.subscriptionPeriodEnd ?? profile?.subscriptionPeriodEnd
  const subPeriodEnd = periodEndRaw
    ? new Date(periodEndRaw).toLocaleDateString('es-ES')
    : null
  const hasActiveSub = ['active', 'trialing', 'canceling'].includes(subStatus)
  const isCanceling = subStatus === 'canceling'
  const canCancelSubscription =
    subInfo?.canCancel ??
    (hasPaidSubscription(plan) ||
      !!profile?.stripeSubscriptionId ||
      (hasActiveSub && subStatus !== 'canceling'))

  useEffect(() => {
    if (shouldUseDemoData(profile)) {
      const demo = resolveDemoProfile()
      const status = demo.subscriptionStatus ?? 'active'
      setSubInfo({
        canCancel: status === 'active' || status === 'trialing',
        subscriptionStatus: status,
        subscriptionPeriodEnd: demo.subscriptionPeriodEnd,
        stripeSubscriptionId: demo.stripeSubscriptionId,
        hasStripeCustomer: false,
        hasPaidPlan: true,
      })
      return
    }
    let cancelled = false
    apiFetch('/api/subscription/status')
      .then((data) => { if (!cancelled) setSubInfo(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [profile])

  useEffect(() => {
    if (searchParams.get('success')) setNotice('¡Pago completado! Tus créditos están disponibles.')
    if (searchParams.get('subscribed')) setNotice('¡Suscripción activada! Bienvenido a ' + planLabel + '.')
    if (searchParams.get('canceled')) setNotice(t('credits.paymentCanceled'))
    const amountParam = searchParams.get('amount')
    if (amountParam && parsePurchaseAmountEur(amountParam) != null) {
      setNotice(t('credits.selectAmountHint'))
    }
  }, [searchParams, t, planLabel])

  const initialAmountEur = parsePurchaseAmountEur(searchParams.get('amount'))

  async function buy(amountEur) {
    if (shouldUseDemoData(profile)) { setError(t('credits.purchase.demoBlocked')); return }
    setLoading(true); setError(null)
    try {
      const { url } = await apiFetch('/api/checkout', { method: 'POST', body: JSON.stringify({ amountEur }) })
      if (url) window.location.href = url
    } catch (e) { setError(e instanceof Error ? e.message : t('credits.checkoutFailed')) }
    setLoading(false)
  }

  async function handleCancelSubscription() {
    setCancelLoading(true); setError(null)
    try {
      if (shouldUseDemoData(profile)) {
        const periodEnd =
          profile?.subscriptionPeriodEnd ?? resolveDemoProfile().subscriptionPeriodEnd
        saveDemoProfilePatch({ subscriptionStatus: 'canceling' })
        setShowCancelConfirm(false)
        setNotice(
          periodEnd
            ? t('set.cancelSuccessUntil', {
                date: new Date(periodEnd).toLocaleDateString('es-ES'),
              })
            : t('set.cancelSuccess'),
        )
        setSubInfo((prev) =>
          prev
            ? { ...prev, canCancel: false, subscriptionStatus: 'canceling' }
            : { canCancel: false, subscriptionStatus: 'canceling' },
        )
        refreshProfile()
        setCancelLoading(false)
        return
      }
      const { cancelAt } = await apiFetch('/api/subscription/cancel', { method: 'POST' })
      setShowCancelConfirm(false)
      setNotice(cancelAt
        ? t('set.cancelSuccessUntil', { date: new Date(cancelAt).toLocaleDateString('es-ES') })
        : t('set.cancelSuccess'))
      setSubInfo((prev) => prev ? { ...prev, canCancel: false, subscriptionStatus: 'canceling' } : prev)
      refreshProfile()
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : t('set.cancelFailed')) }
    setCancelLoading(false)
  }

  async function openPortal() {
    setPortalLoading(true); setError(null)
    try {
      const { url } = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (url) window.location.href = url
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir el portal de facturación') }
    setPortalLoading(false)
  }

  return (
    <div className="settings-billing">
      {notice && <p className="settings-billing-notice">{notice}</p>}
      {error && <p className="settings-billing-error">{error}</p>}

      {/* Plan actual */}
      <section className="settings-section">
        <div className="settings-section-head">
          <h2 className="settings-section-title">{t('set.billingTitle')}</h2>
          <p className="settings-section-desc">{t('set.billingDesc')}</p>
        </div>
        <div className="settings-card settings-billing-plan">
          <div className="settings-billing-plan-main">
            <div className="settings-billing-plan-body">
              <p className="settings-billing-plan-kicker">{t('set.currentPlan')}</p>
              <div className="settings-billing-plan-title-row">
                <p className="settings-billing-plan-name">{planLabel}</p>
                <span className="settings-billing-plan-credits-pill mono">
                  {formatT(t, 'set.creditsAvailable', { available: String(credits), total: String(creditTotal) })}
                </span>
              </div>
              <ul className="settings-billing-plan-meta-list">
                {isCanceling && subPeriodEnd && (
                  <li className="settings-billing-plan-meta settings-billing-plan-meta--warn">
                    {formatT(t, 'set.canceledUntil', { date: subPeriodEnd })}
                  </li>
                )}
                {hasActiveSub && !isCanceling && subPeriodEnd && (
                  <li className="settings-billing-plan-meta">
                    {formatT(t, 'set.nextRenewal', { date: subPeriodEnd })}
                  </li>
                )}
              </ul>
            </div>
            <button
              type="button"
              className="settings-billing-activity-corner"
              onClick={() => navigate('/settings?tab=activity')}
              aria-label={t('set.viewActivity')}
              title={t('set.viewActivity')}
            >
              <BillingActivityChartIcon />
              <span className="settings-billing-activity-label">{t('set.viewActivity')}</span>
            </button>
          </div>
          {(canCancelSubscription && !isCanceling && !showCancelConfirm) ||
          (subInfo?.hasStripeCustomer ?? profile?.hasStripeCustomer) ? (
            <div className="settings-billing-plan-footer">
              <div className="settings-billing-plan-actions">
                {(subInfo?.hasStripeCustomer ?? profile?.hasStripeCustomer) && (
                  <button
                    type="button"
                    className="btn btn-ghost settings-billing-portal-btn"
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? '…' : t('set.billingPortal')}
                  </button>
                )}
                {canCancelSubscription && !isCanceling && !showCancelConfirm && (
                  <button
                    type="button"
                    className="btn settings-billing-cancel-btn"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    {t('set.cancelSubscription')}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {canCancelSubscription && !isCanceling && showCancelConfirm && (
          <div className="settings-card settings-billing-confirm">
            <p className="settings-billing-confirm-title">{t('set.cancelConfirmTitle')}</p>
            <p className="settings-billing-confirm-desc">
              {formatT(t, 'set.cancelConfirmDesc', { plan: planLabel })}
            </p>
            <div className="settings-billing-confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelLoading}
              >
                {t('set.cancelConfirmNo')}
              </button>
              <button
                type="button"
                className="btn settings-billing-confirm-danger"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('set.canceling') : t('set.cancelConfirmYes')}
              </button>
            </div>
          </div>
        )}

        {isCanceling && (
          <div className="settings-card settings-billing-canceled">
            <div className="settings-billing-canceled-copy">
              <p className="settings-billing-canceled-title">{t('set.canceledTitle')}</p>
              <p className="settings-billing-canceled-desc">
                {subPeriodEnd ? formatT(t, 'set.canceledReactivate', { date: subPeriodEnd }) : t('set.canceledReactivateNoDate')}
              </p>
            </div>
            {(subInfo?.hasStripeCustomer ?? profile?.hasStripeCustomer) && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? '…' : t('set.reactivate')}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Compra de créditos adicionales */}
      <section className="settings-section">
        <div className="settings-section-head">
          <h2 className="settings-section-title">{t('set.buyCredits')}</h2>
          <p className="settings-section-desc">{t('set.buyCreditsDesc')}</p>
        </div>
        <CreditPurchaseForm
          initialAmountEur={initialAmountEur}
          loading={loading}
          disabled={shouldUseDemoData(profile)}
          onCheckout={buy}
        />
      </section>
    </div>
  )
}

function ActivitySection() {
  const { t, lang } = useApp()
  const { profile } = useUser()
  const credits = profile?.credits ?? 0
  const plan = profile?.plan ?? 'free'
  const creditTotal = getPlanCreditLimit(plan)
  const { entries, loading } = useSubscriptionHistory()
  const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : lang

  return (
    <div className="settings-activity">
      <section className="settings-section">
        <div className="settings-section-head">
          <h2 className="settings-section-title">{t('set.activity')}</h2>
          <p className="settings-section-desc">{t('set.activityDesc')}</p>
        </div>
        <CreditUsagePanel credits={credits} creditTotal={creditTotal} />
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h2 className="settings-section-title">{t('set.subHistory.title')}</h2>
          <p className="settings-section-desc">{t('set.subHistory.desc')}</p>
        </div>
        <div className="settings-card settings-card--flush settings-sub-history-card">
          {loading ? (
            <p className="settings-billing-empty">{t('set.subHistory.loading')}</p>
          ) : entries.length === 0 ? (
            <p className="settings-billing-empty">{t('set.subHistory.empty')}</p>
          ) : (
            <div className="settings-sub-history-table" role="table">
              <div className="settings-sub-history-head" role="row">
                <span role="columnheader">{t('set.subHistory.col.date')}</span>
                <span role="columnheader">{t('set.subHistory.col.type')}</span>
                <span role="columnheader">{t('set.subHistory.col.plan')}</span>
                <span role="columnheader">{t('set.subHistory.col.amount')}</span>
                <span role="columnheader">{t('set.subHistory.col.status')}</span>
              </div>
              <ul className="settings-sub-history-list">
                {entries.map((entry) => {
                  const planLabel =
                    entry.planId && t(`plan.${entry.planId}`) !== `plan.${entry.planId}`
                      ? t(`plan.${entry.planId}`)
                      : entry.planName
                  return (
                    <li key={entry.id} className="settings-sub-history-row" role="row">
                      <span className="settings-sub-history-date" role="cell">
                        {new Date(entry.createdAt).toLocaleString(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="settings-sub-history-kind" role="cell">
                        {subscriptionHistoryKindLabel(t, entry.kind)}
                      </span>
                      <span className="settings-sub-history-plan" role="cell">
                        {planLabel}
                      </span>
                      <span className="settings-sub-history-amount mono" role="cell">
                        {formatSubscriptionAmount(entry, locale)}
                      </span>
                      <span className="settings-sub-history-status" role="cell">
                        <span
                          className={`settings-sub-history-badge is-${entry.status}`}
                        >
                          {subscriptionHistoryStatusLabel(t, entry.status)}
                        </span>
                        {entry.invoiceUrl && (
                          <a
                            href={entry.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="settings-sub-history-invoice"
                          >
                            {t('set.subHistory.invoice')}
                          </a>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PreferencesSection({ lang, setLang, theme, setTheme }) {
  const { t } = useApp()
  const langs = SK_LANGS
  const { profile, refresh } = useUser()

  async function persistSettings(partial) {
    const next = { ...(profile?.settings ?? {}), ...partial }
    try {
      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ settings: next }),
      })
      await refresh()
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Section title={t('set.appearanceTitle')} desc={t('set.appearanceDesc')}>
        <Row label={t('set.themeLabel')}>
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              gap: 2,
            }}
          >
            {[
              { v: "light", label: t("theme.light"), i: <Icon.Sun /> },
              { v: "dark", label: t("theme.dark"), i: <Icon.Moon /> },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => {
                  setTheme(opt.v)
                  persistSettings({ theme: opt.v })
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 13,
                  borderRadius: "var(--radius-sm)",
                  background: theme === opt.v ? "var(--surface)" : "transparent",
                  color: theme === opt.v ? "var(--text)" : "var(--text-muted)",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {opt.i} {opt.label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title={t('set.languageTitle')} desc={t('set.languageDesc')}>
        <Row label={t('set.displayLanguage')}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 420 }}>
            {langs.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code)
                  persistSettings({ language: l.code })
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid",
                  borderColor: lang === l.code ? "var(--accent)" : "var(--border)",
                  background: lang === l.code ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-elev)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: lang === l.code ? 500 : 400,
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", width: 22 }}>
                  {l.flag}
                </span>
                {l.label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title={t('set.notificationsTitle')}>
        <Row label={t('set.notif.credits')} hint={t('set.notif.creditsHint')}>
          <Toggle on={true} onChange={() => {}} />
        </Row>
        <Row label={t('set.notif.sales')} hint={t('set.notif.salesHint')}>
          <Toggle on={true} onChange={() => {}} />
        </Row>
        <Row label={t('set.notif.digest')} hint={t('set.notif.digestHint')}>
          <Toggle on={false} onChange={() => {}} />
        </Row>
      </Section>

      <DeleteAccountSection />
    </>
  );
}

function SettingsPage() {
  return (
    <Suspense fallback={<div className="app-page"><div className="container settings-page"><p className="integrations-loading">…</p></div></div>}>
      <SettingsPageInner />
    </Suspense>
  )
}

export { SettingsPage }
