'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
  useCallback,
  useMemo,
} from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { SK_I18N } from '@/lib/i18n'
import { useApp, MODELS } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { isAdminEmail } from '@/lib/auth/adminEmails'

// Runlabs42 — Admin Panel

// Pricing constants (mirrored from PricingPage)
const EUR_TO_CREDITS = 100  // 1 € = 100 créditos
const MODEL_CREDITS_PER_REQUEST = {
  'gemini-2.0-flash-lite':          0.5,
  'gemini-2.0-flash':               1.0,
  'gemini-2.5-flash': 1.5,
  'gemini-2.5-pro':   3.0,
}

/* =========================================================
   ICONS
   ========================================================= */
const AdminIcon = {
  Grid:       (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>),
  Bolt:       (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>),
  Tool:       (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  Users:      (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  BarChart2:  (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/></svg>),
  Sun:        (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>),
  Moon:       (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>),
  Check:      (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  X:          (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>),
  Alert:      (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>),
  TrendUp:    (p) => (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>),
  TrendDown:  (p) => (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/></svg>),
  Refresh:    (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>),
  Search:     (p) => (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  UserX:      (p) => (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>),
  UserCheck:  (p) => (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>),
  Eye:        (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>),
  CreditCard: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>),
  EuroSign:   (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10h12M4 14h12M19 6a7 7 0 1 0 0 12"/></svg>),
  ChevronDown:(p) => (<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  Clock:      (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>),
  Mic:        (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>),
  Cloud:      (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>),
  ArrowLeft:  (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>),
  Lock:       (p) => (<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
}

/* =========================================================
   MOCK DATA
   ========================================================= */
// No mock data — all data loaded from Supabase

const INITIAL_CREDIT_CONFIG = {
  enabled: true,
  creditsOnRegister: 10,
  maxPerUser: 10,
  maxTotalBudget: 5000,
  currentTotalGiven: 1223,
  expiresAfterDays: 30,
}

const INITIAL_MAINTENANCE_CONFIG = {
  enabled: false,
  title: 'Estamos mejorando Runlabs42',
  message: 'La plataforma estará disponible en breve. Pedimos disculpas por las molestias causadas.',
  estimatedTime: '',
  contactEmail: 'soporte@runlabs42.com',
}

const INITIAL_SPEECH_DICTATION_CONFIG = {
  enabled: DEFAULT_SPEECH_DICTATION_SETTING.enabled,
}

import {
  DEFAULT_DESIGN_IMAGE_GENERATION_SETTING,
  parseDesignImageGenerationEnabled,
} from '@/lib/platform/designImageGenerationSetting'
import {
  DEFAULT_DESIGN_IMAGE_MODEL_SETTING,
  parseDesignImageModelSetting,
} from '@/lib/platform/designImageModelSetting'
import {
  DEFAULT_VERTEX_GEMINI_BATCH_SETTING,
  parseVertexGeminiBatchEnabled,
} from '@/lib/platform/vertexGeminiBatchSetting'
import {
  DEFAULT_VERTEX_CONTEXT_CACHE_SETTING,
  parseVertexContextCacheSetting,
} from '@/lib/platform/vertexContextCacheSetting'
import {
  MODEL_MENU_VISIBILITY_SETTING_KEY,
  defaultModelMenuVisibility,
  EMPTY_MODEL_MENU_VISIBILITY,
  inferModelMenuBuckets,
  parseModelMenuVisibility,
} from '@/lib/ai/modelMenuVisibility'
import {
  DEFAULT_SPEECH_DICTATION_SETTING,
  parseSpeechDictationEnabled,
  SPEECH_DICTATION_SETTING_KEY,
} from '@/lib/platform/speechDictationSetting'
import {
  DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING,
  DESIGN_CLARIFY_QUESTIONS_SETTING_KEY,
  parseDesignClarifyQuestionsEnabled,
} from '@/lib/platform/designClarifyQuestionsSetting'

const INITIAL_VERTEX_GEMINI_BATCH_CONFIG = {
  enabled: DEFAULT_VERTEX_GEMINI_BATCH_SETTING.enabled,
}

const INITIAL_VERTEX_CONTEXT_CACHE_CONFIG = {
  enabled: DEFAULT_VERTEX_CONTEXT_CACHE_SETTING.enabled,
  minTokens: DEFAULT_VERTEX_CONTEXT_CACHE_SETTING.minTokens,
}

const INITIAL_DESIGN_IMAGE_MODEL_CONFIG = {
  modelId: DEFAULT_DESIGN_IMAGE_MODEL_SETTING.modelId,
}

const INITIAL_DESIGN_IMAGE_GENERATION_CONFIG = {
  enabled: DEFAULT_DESIGN_IMAGE_GENERATION_SETTING.enabled,
}

const INITIAL_DESIGN_CLARIFY_CONFIG = {
  enabled: DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled,
}

/* =========================================================
   TOAST
   ========================================================= */
const ToastCtx = createContext(null)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="adm-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`adm-toast adm-toast--${t.type}`}>
            <span style={{ color: t.type === 'success' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
              {t.type === 'success' ? <AdminIcon.Check /> : <AdminIcon.X />}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function useToast() { return useContext(ToastCtx) }

/* =========================================================
   ADMIN CONTEXT
   ========================================================= */
const AdminCtx = createContext(null)
function useAdmin() { return useContext(AdminCtx) }

/* =========================================================
   TOGGLE
   ========================================================= */
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <div
      className={`adm-toggle-track ${checked ? 'on' : 'off'}`}
      onClick={() => !disabled && onChange(!checked)}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}
      role="switch"
      aria-checked={checked}
    >
      <div className="adm-toggle-thumb" />
    </div>
  )
}

/* =========================================================
   STAT CARD
   ========================================================= */
function StatCard({ label, value, delta, deltaLabel, icon: Icon, accent }) {
  const c = accent || 'var(--accent)'
  const isUp = delta > 0
  return (
    <div className="adm-stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="adm-stat-card-eyebrow">{label}</div>
        {Icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${c} 14%, var(--surface-2))`,
            color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon width="15" height="15" />
          </div>
        )}
      </div>
      <div className="adm-stat-card-value">{value}</div>
      {delta !== undefined && (
        <div className={`adm-stat-card-delta ${isUp ? 'delta-up' : 'delta-down'}`} style={{ marginTop: 8 }}>
          {isUp ? <AdminIcon.TrendUp /> : <AdminIcon.TrendDown />}
          <span>{Math.abs(delta)}% {deltaLabel || 'vs mes anterior'}</span>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   CHARTS
   ========================================================= */
function LineAreaChart({ data, colorLine = 'var(--accent)', height = 150, formatY }) {
  const gradId = useRef(`lg-${Math.random().toString(36).slice(2)}`).current
  const W = 560, H = height
  const PAD = { top: 18, right: 16, bottom: 28, left: 46 }
  const pW = W - PAD.left - PAD.right
  const pH = H - PAD.top - PAD.bottom
  const vals = data.map(d => d.value)
  const max  = Math.max(...vals, 1) * 1.12

  const pts = vals.map((v, i) => ({
    x: PAD.left + (vals.length < 2 ? pW / 2 : (i / (vals.length - 1)) * pW),
    y: PAD.top + pH - (v / max) * pH,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = pts.length > 1
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + pH).toFixed(1)} L${PAD.left},${(PAD.top + pH).toFixed(1)} Z`
    : ''

  const yTicks = [0, 0.5, 1].map(t => ({
    y: PAD.top + pH * (1 - t),
    label: formatY ? formatY(max * t) : Math.round(max * t).toLocaleString('es-ES'),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLine} stopOpacity="0.22" />
          <stop offset="100%" stopColor={colorLine} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={PAD.left + pW} y2={t.y} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">{t.label}</text>
        </g>
      ))}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={colorLine} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colorLine} stroke="var(--surface)" strokeWidth="2" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={pts[i].x} y={H - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">{d.label}</text>
      ))}
    </svg>
  )
}

function BarChart({ data, color = 'var(--accent)', height = 150 }) {
  const W = 560, H = height
  const PAD = { top: 18, right: 16, bottom: 28, left: 46 }
  const pW = W - PAD.left - PAD.right
  const pH = H - PAD.top - PAD.bottom
  const vals = data.map(d => d.value)
  const max  = Math.max(...vals, 1) * 1.12
  const step = pW / vals.length
  const barW = Math.max(16, step * 0.55)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      {[0.5, 1].map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={PAD.top + pH * (1 - t)} x2={PAD.left + pW} y2={PAD.top + pH * (1 - t)} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.left - 8} y={PAD.top + pH * (1 - t) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">
            {Math.round(max * t).toLocaleString('es-ES')}
          </text>
        </g>
      ))}
      {vals.map((v, i) => {
        const bH = (v / max) * pH
        const x  = PAD.left + step * i + step / 2 - barW / 2
        const y  = PAD.top + pH - bH
        return <rect key={i} x={x} y={y} width={barW} height={bH} rx={3} fill={color} opacity={0.82} />
      })}
      {data.map((d, i) => (
        <text key={i} x={PAD.left + step * i + step / 2} y={H - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">{d.label}</text>
      ))}
    </svg>
  )
}

function DonutChart({ segments, size = 130, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={size * 0.38} fill="none" stroke="var(--border)" strokeWidth={size * 0.13} />
        <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-sans)">Sin datos</text>
      </svg>
    )
  }
  let angle = -Math.PI / 2
  const arcs = segments.map(seg => {
    const sweep = (seg.value / total) * Math.PI * 2
    const r = size * 0.40, ri = size * 0.27
    const cx = size / 2, cy = size / 2
    const x1 = cx + r  * Math.cos(angle),        y1 = cy + r  * Math.sin(angle)
    const x2 = cx + r  * Math.cos(angle + sweep), y2 = cy + r  * Math.sin(angle + sweep)
    const x3 = cx + ri * Math.cos(angle + sweep), y3 = cy + ri * Math.sin(angle + sweep)
    const x4 = cx + ri * Math.cos(angle),         y4 = cy + ri * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const path = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${ri} ${ri} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}Z`
    angle += sweep
    return { ...seg, path }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => <path key={i} d={arc.path} fill={arc.color} />)}
      {centerLabel && (
        <>
          <text x={size/2} y={size/2 - 3} textAnchor="middle" fill="var(--text)" fontSize="16" fontWeight="700" fontFamily="var(--font-display)">{centerLabel}</text>
          {centerSub && <text x={size/2} y={size/2 + 13} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-sans)">{centerSub}</text>}
        </>
      )}
    </svg>
  )
}

/* =========================================================
   OVERVIEW PAGE
   ========================================================= */
const DESIGN_IMAGE_MODEL_LABEL_KEYS = {
  'gemini-2.5-flash-image': 'ed.modelNanoBanana',
  'imagen-3.0-fast-generate-001': 'ed.modelImagen3Fast',
  'imagen-3.0-generate-002': 'ed.modelImagen3',
  'imagen-4.0-generate-001': 'ed.modelImagen4',
  'imagen-4.0-fast-generate-001': 'ed.modelImagen4Fast',
}

function imagenModelFamilySuffix(modelId) {
  if (modelId?.includes('imagen-3')) return ' · Imagen 3'
  if (modelId?.includes('imagen-4')) return ' · Imagen 4'
  return ' · Imagen'
}

function OverviewPage() {
  const {
    creditConfig,
    maintenanceConfig,
    speechDictationConfig,
    designImageGenerationConfig,
    designImageModelConfig,
    users,
    setSection,
  } = useAdmin()
  const toast = useToast()

  const proUsers  = users.filter(u => u.plan !== 'free').length
  const budgetPct = Math.min(100, (creditConfig.currentTotalGiven / creditConfig.maxTotalBudget) * 100)

  const kpis = [
    { label: 'Usuarios totales',  value: users.length.toString(), delta: null, icon: AdminIcon.Users,      accent: 'var(--accent)' },
    { label: 'Suscriptores Pro',  value: proUsers.toString(),      delta: null, icon: AdminIcon.CreditCard, accent: 'var(--accent-2)' },
    { label: 'Créditos en uso',   value: users.reduce((s,u) => s+(u.credits||0), 0).toLocaleString('es-ES'), delta: null, icon: AdminIcon.Bolt, accent: 'var(--success)' },
    { label: 'MRR estimado',      value: '—',                      delta: null, icon: AdminIcon.EuroSign,   accent: 'var(--warning)' },
  ]

  const dict = (SK_I18N.es ?? SK_I18N.en) || SK_I18N.en
  const imageModelLabelKey = DESIGN_IMAGE_MODEL_LABEL_KEYS[designImageModelConfig.modelId]
  const imageModelLabel = imageModelLabelKey ? dict[imageModelLabelKey] : designImageModelConfig.modelId

  const systemStatus = [
    { label: 'Plataforma',         cls: maintenanceConfig.enabled ? 'warning' : 'success', text: maintenanceConfig.enabled ? 'Mantenimiento' : 'Operativa' },
    { label: 'Créditos de prueba', cls: creditConfig.enabled ? 'success' : 'warning',      text: creditConfig.enabled ? 'Activos' : 'Desactivados' },
    { label: 'Dictado por voz',   cls: speechDictationConfig.enabled ? 'success' : 'warning', text: speechDictationConfig.enabled ? 'Activo' : 'Desactivado' },
    {
      label: 'Imágenes diseño',
      cls: designImageGenerationConfig.enabled ? 'success' : 'warning',
      text: designImageGenerationConfig.enabled ? imageModelLabel : 'Desactivado',
    },
    { label: 'Pagos (Stripe)',     cls: 'success', text: 'Conectado' },
    { label: 'Base de datos',      cls: 'success', text: 'Normal' },
    { label: 'IA (Gemini)',    cls: 'success', text: 'Operativo' },
    { label: 'CDN / Edge',         cls: 'success', text: 'Normal' },
  ]

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Panel de administración</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Resumen</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>Estado general de la plataforma Runlabs42.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Datos actualizados', 'success')}>
            <AdminIcon.Refresh /> Actualizar
          </button>
        </div>
      </div>

      {maintenanceConfig.enabled && (
        <div className="adm-maintenance-banner" style={{ marginBottom: 20 }}>
          <AdminIcon.Alert style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Modo mantenimiento activo</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>
              Los usuarios no pueden acceder a la plataforma.
            </span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setSection('maintenance')}>Gestionar →</button>
        </div>
      )}

      <div className="adm-stat-grid" style={{ marginBottom: 28 }}>
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      <div className="adm-page-grid-2" style={{ marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: 16 }}>Estado del sistema</h3>
          {systemStatus.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < systemStatus.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
              <span style={{ fontSize: 14, color: 'var(--text-mid)' }}>{item.label}</span>
              <span className={`adm-pill adm-pill--${item.cls}`}><span className="adm-pill-dot" />{item.text}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: 4 }}>Presupuesto créditos gratis</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            <strong style={{ color: 'var(--text)' }}>{creditConfig.currentTotalGiven.toLocaleString('es-ES')}</strong> de {creditConfig.maxTotalBudget.toLocaleString('es-ES')} créditos repartidos
          </p>
          <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{
              height: '100%',
              width: `${budgetPct}%`,
              background: budgetPct > 85 ? 'var(--danger)' : budgetPct > 65 ? 'var(--warning)' : 'var(--accent-grad)',
              borderRadius: 4,
              transition: 'width 600ms var(--ease)',
            }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Al registrarse',   val: `${creditConfig.creditsOnRegister} cr.` },
              { label: 'Máx por usuario',  val: `${creditConfig.maxPerUser} cr.` },
              { label: 'Caducan en',       val: `${creditConfig.expiresAfterDays} días` },
            ].map(it => (
              <div key={it.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{it.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{it.val}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => setSection('credits')}>
            Gestionar créditos →
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Últimos registros</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setSection('users')}>Ver todos →</button>
        </div>
        {[...users].slice(-5).reverse().map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div className="adm-user-avatar">{u.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            <span className={u.plan === 'pro' ? 'adm-pill adm-pill--accent' : 'adm-pill'}>{u.plan === 'pro' ? 'Pro' : 'Free'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 90, textAlign: 'right', flexShrink: 0 }}>{u.joined}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   FEATURES PAGE (micrófono / dictado)
   ========================================================= */
function FeaturesPage() {
  const {
    speechDictationConfig,
    setSpeechDictationConfig,
    designClarifyConfig,
    setDesignClarifyConfig,
    designImageGenerationConfig,
    setDesignImageGenerationConfig,
    designImageModelConfig,
    setDesignImageModelConfig,
    vertexGeminiBatchConfig,
    setVertexGeminiBatchConfig,
    vertexContextCacheConfig,
    setVertexContextCacheConfig,
  } = useAdmin()
  const toast = useToast()
  const dict = (SK_I18N.es ?? SK_I18N.en) || SK_I18N.en
  const t = (key) => dict[key] || key

  const [speechLocal, setSpeechLocal] = useState({ ...speechDictationConfig })
  const [clarifyLocal, setClarifyLocal] = useState({ ...designClarifyConfig })
  const [imageGenLocal, setImageGenLocal] = useState({ ...designImageGenerationConfig })
  const [imageLocal, setImageLocal] = useState({ ...designImageModelConfig })
  const [batchLocal, setBatchLocal] = useState({ ...vertexGeminiBatchConfig })
  const [contextCacheLocal, setContextCacheLocal] = useState({ ...vertexContextCacheConfig })
  const [imageModels, setImageModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [savingSpeech, setSavingSpeech] = useState(false)
  const [savingClarify, setSavingClarify] = useState(false)
  const [savingImageGen, setSavingImageGen] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)
  const [savingContextCache, setSavingContextCache] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [orchStatus, setOrchStatus] = useState(null)
  const [orchEnabled, setOrchEnabled] = useState(false)
  const [orchLoading, setOrchLoading] = useState(true)
  const [deployingOrch, setDeployingOrch] = useState(false)
  const [undeployingOrch, setUndeployingOrch] = useState(false)
  const [savingOrchToggle, setSavingOrchToggle] = useState(false)

  const loadOrchStatus = useCallback(async () => {
    setOrchLoading(true)
    try {
      const data = await apiFetch('/api/admin/design-orchestrator')
      setOrchStatus(data)
      setOrchEnabled(data?.setting?.enabled === true)
    } catch {
      setOrchStatus(null)
    } finally {
      setOrchLoading(false)
    }
  }, [])

  useEffect(() => { loadOrchStatus() }, [loadOrchStatus])

  useEffect(() => { setSpeechLocal({ ...speechDictationConfig }) }, [speechDictationConfig])
  useEffect(() => { setClarifyLocal({ ...designClarifyConfig }) }, [designClarifyConfig])
  useEffect(() => { setImageGenLocal({ ...designImageGenerationConfig }) }, [designImageGenerationConfig])
  useEffect(() => { setBatchLocal({ ...vertexGeminiBatchConfig }) }, [vertexGeminiBatchConfig])
  useEffect(() => { setContextCacheLocal({ ...vertexContextCacheConfig }) }, [vertexContextCacheConfig])
  useEffect(() => { setImageLocal({ ...designImageModelConfig }) }, [designImageModelConfig])

  useEffect(() => {
    let cancelled = false
    setModelsLoading(true)
    apiFetch('/api/ai/models')
      .then((data) => {
        if (!cancelled && Array.isArray(data?.imageModels)) {
          setImageModels(data.imageModels)
        }
      })
      .catch(() => {
        if (!cancelled) setImageModels([])
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })
    return () => { cancelled = true }
  }, [])


  async function saveSpeech() {
    setSavingSpeech(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: SPEECH_DICTATION_SETTING_KEY, value: speechLocal }),
      })
      setSpeechDictationConfig({ ...speechLocal })
      window.dispatchEvent(new Event('platform-features-changed'))
      toast('Dictado guardado correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingSpeech(false)
    }
  }

  async function saveClarify() {
    setSavingClarify(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          key: DESIGN_CLARIFY_QUESTIONS_SETTING_KEY,
          value: clarifyLocal,
        }),
      })
      setDesignClarifyConfig({ ...clarifyLocal })
      window.dispatchEvent(new Event('platform-features-changed'))
      toast('Preguntas de aclaración guardadas correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingClarify(false)
    }
  }

  async function saveImageGeneration() {
    setSavingImageGen(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'design_image_generation', value: imageGenLocal }),
      })
      setDesignImageGenerationConfig({ ...imageGenLocal })
      toast('Generación de imágenes guardada correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingImageGen(false)
    }
  }

  async function saveVertexGeminiBatch() {
    setSavingBatch(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'vertex_gemini_batch_api', value: batchLocal }),
      })
      setVertexGeminiBatchConfig({ ...batchLocal })
      toast('Vertex Batch API guardada correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingBatch(false)
    }
  }

  async function saveVertexContextCache() {
    setSavingContextCache(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          key: VERTEX_CONTEXT_CACHE_SETTING_KEY,
          value: {
            enabled: contextCacheLocal.enabled === true,
            minTokens: Math.max(1, Number(contextCacheLocal.minTokens) || 1),
          },
        }),
      })
      setVertexContextCacheConfig({
        enabled: contextCacheLocal.enabled === true,
        minTokens: Math.max(1, Number(contextCacheLocal.minTokens) || 1),
      })
      toast('Context cache de Vertex guardado correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingContextCache(false)
    }
  }

  async function saveImageModel() {
    setSavingImage(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'design_image_model', value: imageLocal }),
      })
      setDesignImageModelConfig({ ...imageLocal })
      toast('Modelo de imagen guardado correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingImage(false)
    }
  }


  async function saveOrchToggle(nextEnabled) {
    setSavingOrchToggle(true)
    try {
      await apiFetch('/api/admin/design-orchestrator', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      setOrchEnabled(nextEnabled)
      await loadOrchStatus()
      toast(
        nextEnabled
          ? 'Orquestador de Google Cloud activado'
          : 'Orquestador local activado (sin Agent Engine)',
        'success',
      )
    } catch (e) {
      setOrchEnabled(!nextEnabled)
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSavingOrchToggle(false)
    }
  }

  async function deployOrchestrator() {
    setDeployingOrch(true)
    try {
      await apiFetch('/api/admin/design-orchestrator', { method: 'POST' })
      await loadOrchStatus()
      toast('Orquestador desplegado en Google Cloud', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error en el despliegue', 'error')
      await loadOrchStatus()
    } finally {
      setDeployingOrch(false)
    }
  }

  async function undeployOrchestrator() {
    if (!window.confirm('¿Eliminar el orquestador de Google Cloud y los artefactos de staging? Solo seguirás pagando el uso de Vertex (modelos), no Agent Engine.')) {
      return
    }
    setUndeployingOrch(true)
    try {
      await apiFetch('/api/admin/design-orchestrator', { method: 'DELETE' })
      setOrchEnabled(false)
      await loadOrchStatus()
      toast('Recursos de Agent Engine eliminados', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al eliminar', 'error')
      await loadOrchStatus()
    } finally {
      setUndeployingOrch(false)
    }
  }

  const orchEngineResource =
    orchStatus?.setting?.engineResource ||
    orchStatus?.engines?.[0]?.resource ||
    null
  const orchDeployed = Boolean(orchEngineResource || (orchStatus?.engines?.length ?? 0) > 0)
  const orchDeployStatus = orchStatus?.setting?.deployStatus ?? 'idle'


  const speechDirty = JSON.stringify(speechLocal) !== JSON.stringify(speechDictationConfig)
  const clarifyDirty = JSON.stringify(clarifyLocal) !== JSON.stringify(designClarifyConfig)
  const imageGenDirty = JSON.stringify(imageGenLocal) !== JSON.stringify(designImageGenerationConfig)
  const batchDirty = JSON.stringify(batchLocal) !== JSON.stringify(vertexGeminiBatchConfig)
  const contextCacheDirty =
    JSON.stringify(contextCacheLocal) !== JSON.stringify(vertexContextCacheConfig)
  const imageDirty = JSON.stringify(imageLocal) !== JSON.stringify(designImageModelConfig)

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Configuración</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>
            Funciones de la plataforma
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Dictado por voz, orquestador de diseño en Google Cloud y generación de imágenes.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: clarifyLocal.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: clarifyLocal.enabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: clarifyLocal.enabled
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: clarifyLocal.enabled ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.Tool width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
              Preguntas de aclaración en Studio
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Permite que la IA haga hasta 5 preguntas antes de generar el diseño para afinar requisitos.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <Toggle checked={clarifyLocal.enabled} onChange={(v) => setClarifyLocal((prev) => ({ ...prev, enabled: v }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              {clarifyDirty && (
                <button className="btn btn-ghost btn-sm" onClick={() => setClarifyLocal({ ...designClarifyConfig })}>
                  Cancelar
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                onClick={saveClarify}
                disabled={savingClarify || !clarifyDirty}
                style={{ opacity: clarifyDirty && !savingClarify ? 1 : 0.55 }}
              >
                {savingClarify ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: contextCacheLocal.enabled
            ? 'var(--surface)'
            : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: contextCacheLocal.enabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: contextCacheLocal.enabled
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: contextCacheLocal.enabled ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.Cloud width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Vertex Context Cache</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Reutiliza contexto estático en Gemini/Vertex para reducir latencia y costo. Ajusta el umbral mínimo de tokens para activar caché.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Mínimo tokens</label>
              <input
                type="number"
                min={1}
                step={1}
                value={contextCacheLocal.minTokens}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setContextCacheLocal((prev) => ({
                    ...prev,
                    minTokens: Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1,
                  }))
                }}
                className="adm-input"
                style={{ width: 140 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <Toggle
              checked={contextCacheLocal.enabled}
              onChange={(v) => setContextCacheLocal((prev) => ({ ...prev, enabled: v }))}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {contextCacheDirty && (
                <button className="btn btn-ghost btn-sm" onClick={() => setContextCacheLocal({ ...vertexContextCacheConfig })}>
                  Cancelar
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                onClick={saveVertexContextCache}
                disabled={savingContextCache || !contextCacheDirty}
                style={{ opacity: contextCacheDirty && !savingContextCache ? 1 : 0.55 }}
              >
                {savingContextCache ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: speechLocal.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: speechLocal.enabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: speechLocal.enabled
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: speechLocal.enabled ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.Mic width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Dictado por voz</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Muestra el botón de micrófono en el compositor del chat y permite dictar texto.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <Toggle checked={speechLocal.enabled} onChange={(v) => setSpeechLocal((prev) => ({ ...prev, enabled: v }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              {speechDirty && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSpeechLocal({ ...speechDictationConfig })}>
                  Cancelar
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                onClick={saveSpeech}
                disabled={savingSpeech || !speechDirty}
                style={{ opacity: speechDirty && !savingSpeech ? 1 : 0.55 }}
              >
                {savingSpeech ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: imageGenLocal.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: imageGenLocal.enabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: imageGenLocal.enabled
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: imageGenLocal.enabled ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.Bolt width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Generación de imágenes</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Mockups Imagen (Vertex / Model Garden), assets [IMAGE:] en diseño y etiquetas de imagen en la creación de webs (spec-kit).
              Sin llamadas a modelos de imagen mientras esté desactivado.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <Toggle
              checked={imageGenLocal.enabled}
              onChange={(v) => setImageGenLocal((prev) => ({ ...prev, enabled: v }))}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {imageGenDirty && (
                <button className="btn btn-ghost btn-sm" onClick={() => setImageGenLocal({ ...designImageGenerationConfig })}>
                  Cancelar
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                onClick={saveImageGeneration}
                disabled={savingImageGen || !imageGenDirty}
                style={{ opacity: imageGenDirty && !savingImageGen ? 1 : 0.55 }}
              >
                {savingImageGen ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: batchLocal.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: batchLocal.enabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: batchLocal.enabled
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: batchLocal.enabled ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.EuroSign width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Vertex Batch API (Gemini)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Desactivado por defecto. Usa la API por lotes de Vertex para llamadas de texto sin tiempo real (diseño, mejoras de prompt, etc.).
              Requiere staging en GCS en Vertex. El chat en streaming sigue en modo síncrono.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <Toggle
              checked={batchLocal.enabled}
              onChange={(v) => setBatchLocal((prev) => ({ ...prev, enabled: v }))}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {batchDirty && (
                <button className="btn btn-ghost btn-sm" onClick={() => setBatchLocal({ ...vertexGeminiBatchConfig })}>
                  Cancelar
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                onClick={saveVertexGeminiBatch}
                disabled={savingBatch || !batchDirty}
                style={{ opacity: batchDirty && !savingBatch ? 1 : 0.55 }}
              >
                {savingBatch ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 16,
          background: orchEnabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
          borderColor: orchEnabled ? 'var(--border)' : 'var(--hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
              background: orchDeployed
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))'
                : 'var(--surface-3)',
              color: orchDeployed ? 'var(--accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon.Cloud width="20" height="20" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
              Orquestador de diseño (Google Cloud)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Desactivado por defecto. Despliega el pipeline modular (tokens → layout → assets) en Vertex Agent Engine y activa «Usar en la web» solo si lo necesitas.
              Con el interruptor desactivado, la web usa el orquestador local en proceso.
            </div>
            {orchLoading ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 10 }}>Cargando estado…</p>
            ) : (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <div>
                  GCP:{' '}
                  {orchStatus?.gcpConfigured ? (
                    <span style={{ color: 'var(--success)' }}>configurado</span>
                  ) : (
                    <span style={{ color: 'var(--warning)' }}>sin credenciales Vertex</span>
                  )}
                </div>
                <div>
                  Agent Engine:{' '}
                  {orchDeployed ? (
                    <span style={{ color: 'var(--success)' }}>
                      {orchDeployStatus === 'deploying' ? 'desplegando…' : 'desplegado'}
                    </span>
                  ) : (
                    <span>no desplegado</span>
                  )}
                </div>
                {orchEngineResource ? (
                  <div style={{ marginTop: 4, wordBreak: 'break-all', fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5 }}>
                    {orchEngineResource}
                  </div>
                ) : null}
                {orchStatus?.setting?.deployMessage && orchDeployStatus === 'error' ? (
                  <div style={{ marginTop: 6, color: 'var(--danger)', whiteSpace: 'pre-wrap' }}>
                    {orchStatus.setting.deployMessage.slice(-400)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Usar en la web</span>
              <Toggle
                checked={orchEnabled}
                disabled={savingOrchToggle || !orchDeployed || orchLoading}
                onChange={(v) => {
                  setOrchEnabled(v)
                  saveOrchToggle(v)
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-accent btn-sm"
                onClick={deployOrchestrator}
                disabled={deployingOrch || undeployingOrch || orchLoading || !orchStatus?.gcpConfigured}
              >
                {deployingOrch ? 'Desplegando…' : orchDeployed ? 'Actualizar deploy' : 'Desplegar en GCP'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={loadOrchStatus}
                disabled={orchLoading || deployingOrch || undeployingOrch}
                title="Actualizar estado"
              >
                <AdminIcon.Refresh width="14" height="14" />
              </button>
              {orchDeployed ? (
                <button
                  className="btn btn-sm"
                  style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border))' }}
                  onClick={undeployOrchestrator}
                  disabled={deployingOrch || undeployingOrch || orchLoading}
                >
                  {undeployingOrch ? 'Eliminando…' : 'Eliminar de GCP'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, opacity: imageGenLocal.enabled ? 1 : 0.55 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Modelo de imagen (diseño)</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Assets generados con etiquetas [IMAGE:] y referencias en HTML del Studio. Solo modelos estables (GA).
            {!imageGenLocal.enabled && (
              <span style={{ display: 'block', marginTop: 6, color: 'var(--warning)' }}>
                Activa la generación de imágenes arriba para usar este modelo.
              </span>
            )}
          </div>
        </div>

        {modelsLoading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando modelos de imagen…</p>
        ) : imageModels.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--warning)' }}>
            No se pudieron cargar los modelos. Comprueba que la API de IA esté disponible.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {imageModels.map((m) => {
              const selected = imageLocal.modelId === m.id
              const label = t(m.labelKey)
              const price =
                m.perImage != null
                  ? t('ed.pricePerImage').replace('{price}', `$${m.perImage.toFixed(3)}`)
                  : null
              return (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--hairline)'}`,
                    background: selected
                      ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))'
                      : 'var(--surface-2)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="design-image-model"
                    checked={selected}
                    onChange={() => setImageLocal({ modelId: m.id })}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {m.id}
                      {m.kind === 'imagen' ? imagenModelFamilySuffix(m.id) : ' · Nano Banana'}
                    </div>
                    {price && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{price}</div>
                    )}
                  </div>
                  {selected && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase' }}>
                      Activo
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {imageDirty && (
            <button className="btn btn-ghost btn-sm" onClick={() => setImageLocal({ ...designImageModelConfig })}>
              Cancelar
            </button>
          )}
          <button
            className="btn btn-accent btn-sm"
            onClick={saveImageModel}
            disabled={savingImage || !imageDirty || modelsLoading || !imageModels.length || !imageGenLocal.enabled}
            style={{ opacity: imageDirty && !savingImage ? 1 : 0.55 }}
          >
            {savingImage ? 'Guardando…' : 'Guardar modelo de imagen'}
          </button>
        </div>
      </div>

    </div>
  )
}

/* =========================================================
   MODELS PAGE
   ========================================================= */
function ModelsPage() {
  const { modelMenuVisibilityConfig, setModelMenuVisibilityConfig } = useAdmin()
  const toast = useToast()
  const dict = (SK_I18N.es ?? SK_I18N.en) || SK_I18N.en
  const t = (key) => dict[key] || key
  const PAGE_SIZE = 50

  const [pricingRows, setPricingRows] = useState([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const [refreshingPricing, setRefreshingPricing] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [pricingUpdatedAt, setPricingUpdatedAt] = useState('')
  const [modelMenuLocal, setModelMenuLocal] = useState({ ...EMPTY_MODEL_MENU_VISIBILITY })
  const [savingModelMenu, setSavingModelMenu] = useState(false)
  const [activeModelBucket, setActiveModelBucket] = useState(null)
  const [searchByBucket, setSearchByBucket] = useState({ language: '', coding: '', ocr: '' })
  const [pageByBucket, setPageByBucket] = useState({ language: 1, coding: 1, ocr: 1 })

  const loadPricingSnapshot = useCallback(async () => {
    setPricingLoading(true)
    setPricingError('')
    try {
      const data = await apiFetch('/api/admin/pricing/refresh')
      const rows = Array.isArray(data?.snapshot?.rows) ? data.snapshot.rows : []
      setPricingRows(rows)
      setPricingUpdatedAt(data?.snapshot?.updatedAt || '')
      if (data?.visibility) {
        const ids = rows.map((row) => row.id)
        const visibility = parseModelMenuVisibility(data.visibility, ids)
        setModelMenuVisibilityConfig(visibility)
        setModelMenuLocal(visibility)
      }
    } catch {
      setPricingRows([])
      setPricingUpdatedAt('')
      setPricingError('No se pudo cargar modelos y selección desde la base de datos.')
    } finally {
      setPricingLoading(false)
    }
  }, [setModelMenuVisibilityConfig])

  useEffect(() => {
    loadPricingSnapshot()
  }, [loadPricingSnapshot])

  const comparableTextModels = useMemo(
    () =>
      pricingRows.filter((row) => {
        if (row.id === 'auto' || row.id === 'max') return false
        if (row.status !== 'ga' && row.status !== 'preview') return false
        return (
          inferModelMenuBuckets(row.id, {
            category: row.category,
            displayName: row.displayName,
            description: row.description,
          }).length > 0
        )
      }),
    [pricingRows],
  )

  const comparableTextModelIds = useMemo(
    () => comparableTextModels.map((row) => row.id),
    [comparableTextModels],
  )

  useEffect(() => {
    setModelMenuLocal(parseModelMenuVisibility(modelMenuVisibilityConfig, comparableTextModelIds))
  }, [modelMenuVisibilityConfig, comparableTextModelIds])

  const modelBuckets = useMemo(
    () => [
      { id: 'language', label: 'Lenguaje' },
      { id: 'coding', label: 'Código' },
      { id: 'ocr', label: 'OCR' },
    ],
    [],
  )

  const groupedModelOptions = useMemo(() => {
    const byBucket = { language: [], coding: [], ocr: [] }
    for (const row of comparableTextModels) {
      const groups = inferModelMenuBuckets(row.id, {
        category: row.category,
        displayName: row.displayName,
        description: row.description,
      })
      for (const group of groups) byBucket[group].push(row)
    }
    return byBucket
  }, [comparableTextModels])

  function fmtMoney(value) {
    if (value == null || Number.isNaN(Number(value))) return '—'
    const n = Number(value)
    const decimals = n >= 1 ? 2 : n >= 0.01 ? 3 : 4
    return `$${n.toFixed(decimals)}`
  }

  function modelLabel(row) {
    if (row.labelKey) return t(row.labelKey)
    return row.displayName || row.id
  }

  function modelSearchHaystack(row) {
    return [row.id, row.displayName, row.description, modelLabel(row)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  const filteredBucketRows = useMemo(() => {
    const out = { language: [], coding: [], ocr: [] }
    for (const bucket of ['language', 'coding', 'ocr']) {
      const q = (searchByBucket[bucket] || '').trim().toLowerCase()
      out[bucket] = (groupedModelOptions[bucket] || []).filter(
        (row) => !q || modelSearchHaystack(row).includes(q),
      )
    }
    return out
  }, [groupedModelOptions, searchByBucket, t])

  function modelSearchPrice(row) {
    let line = ''
    if (row.totalPerM != null) line = `Total ${fmtMoney(row.totalPerM)} / 1M`
    else if (row.inputPerM != null || row.outputPerM != null) {
      line = `In ${fmtMoney(row.inputPerM)} · Out ${fmtMoney(row.outputPerM)}`
    } else if (row.perImage != null) line = `${fmtMoney(row.perImage)} por imagen`
    else if (row.perSecondVideo != null) line = `${fmtMoney(row.perSecondVideo)} por segundo`
    else line = 'Precio no disponible'

    if (
      row.priceCatalogId &&
      row.priceCatalogId !== row.id &&
      row.priceMatch &&
      row.priceMatch !== 'none' &&
      line !== 'Precio no disponible'
    ) {
      return `${line} · ref. ${row.priceCatalogId}`
    }
    return line
  }

  function toggleModelInBucket(bucket, modelId) {
    setModelMenuLocal((prev) => {
      const list = prev[bucket] || []
      const nextList = list.includes(modelId)
        ? list.filter((id) => id !== modelId)
        : [...list, modelId]
      return { ...prev, [bucket]: nextList }
    })
  }

  async function refreshPricingTable() {
    setRefreshingPricing(true)
    setPricingError('')
    try {
      const data = await apiFetch('/api/admin/pricing/refresh', { method: 'POST' })
      const rows = Array.isArray(data?.snapshot?.rows) ? data.snapshot.rows : []
      setPricingRows(rows)
      setPricingUpdatedAt(data?.snapshot?.updatedAt || '')
      if (data?.visibility) {
        const visibility = parseModelMenuVisibility(
          data.visibility,
          rows.map((row) => row.id),
        )
        setModelMenuVisibilityConfig(visibility)
        setModelMenuLocal(visibility)
      }
      toast('Lista y precios guardados en la base de datos', 'success')
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Error al consultar Vertex AI.')
      toast(e instanceof Error ? e.message : 'Error al actualizar precios', 'error')
    } finally {
      setRefreshingPricing(false)
    }
  }

  async function saveModelMenuVisibility() {
    setSavingModelMenu(true)
    try {
      const payload = parseModelMenuVisibility(modelMenuLocal, comparableTextModelIds)
      const data = await apiFetch('/api/admin/pricing/refresh', {
        method: 'PATCH',
        body: JSON.stringify({ visibility: payload }),
      })
      const saved = data?.visibility ?? payload
      setModelMenuVisibilityConfig(saved)
      setModelMenuLocal(saved)
      toast('Selección guardada en la base de datos', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar selección de modelos', 'error')
    } finally {
      setSavingModelMenu(false)
    }
  }

  const modelMenuDirty =
    JSON.stringify(parseModelMenuVisibility(modelMenuLocal, comparableTextModelIds)) !==
    JSON.stringify(parseModelMenuVisibility(modelMenuVisibilityConfig, comparableTextModelIds))

  const visibleTotalCount = useMemo(() => {
    const ids = new Set([
      ...(modelMenuLocal.language || []),
      ...(modelMenuLocal.coding || []),
      ...(modelMenuLocal.ocr || []),
    ])
    return ids.size
  }, [modelMenuLocal])

  function selectAllInBucket(bucket) {
    const allIds = (groupedModelOptions[bucket] || []).map((row) => row.id)
    setModelMenuLocal((prev) => ({ ...prev, [bucket]: allIds }))
  }

  function clearBucket(bucket) {
    setModelMenuLocal((prev) => ({ ...prev, [bucket]: [] }))
  }

  function restoreRecommendedBuckets() {
    setModelMenuLocal(defaultModelMenuVisibility(comparableTextModelIds))
    toast('Selección recomendada restaurada', 'success')
  }

  const pricingUpdatedLabel = useMemo(() => {
    if (!pricingUpdatedAt) return 'Sin actualización previa'
    const dt = new Date(pricingUpdatedAt)
    if (Number.isNaN(dt.getTime())) return pricingUpdatedAt
    return dt.toLocaleString('es-ES')
  }, [pricingUpdatedAt])

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Configuración</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>
            Modelos IA visibles
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Escoge qué modelos de Vertex AI Agent Platform aparecen en el menú del usuario.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {modelBuckets.map((bucket) => (
              <button
                key={bucket.id}
                type="button"
                className={`btn btn-sm ${activeModelBucket === bucket.id ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => {
                  setActiveModelBucket((prev) => (prev === bucket.id ? null : bucket.id))
                  setPageByBucket((prev) => ({ ...prev, [bucket.id]: 1 }))
                }}
              >
                {bucket.label} <span style={{ opacity: 0.75 }}>({(modelMenuLocal[bucket.id] || []).length})</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="adm-pill adm-pill--accent">
              <span className="adm-pill-dot" />
              {visibleTotalCount} modelos visibles
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={restoreRecommendedBuckets}
              type="button"
            >
              Restaurar recomendados
            </button>
            {modelMenuDirty ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setModelMenuLocal(parseModelMenuVisibility(modelMenuVisibilityConfig, comparableTextModelIds))
                }
              >
                Cancelar
              </button>
            ) : null}
            <button
              className="btn btn-accent btn-sm"
              onClick={saveModelMenuVisibility}
              disabled={savingModelMenu || !modelMenuDirty}
              style={{ opacity: modelMenuDirty && !savingModelMenu ? 1 : 0.55 }}
            >
              {savingModelMenu ? 'Guardando…' : 'Guardar visibilidad'}
            </button>
          </div>
        </div>

        {!pricingLoading && comparableTextModels.length === 0 ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--hairline)',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Aún no hay modelos cargados. Pulsa el botón para consultarlos en Google Cloud.
            </span>
            <button
              className="btn btn-accent btn-sm"
              onClick={refreshPricingTable}
              disabled={refreshingPricing}
              type="button"
            >
              <AdminIcon.Refresh /> {refreshingPricing ? 'Cargando…' : 'Cargar ahora'}
            </button>
          </div>
        ) : null}

        {pricingError ? (
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--danger)' }}>{pricingError}</p>
        ) : null}

        {activeModelBucket ? (
          <div
            style={{
              marginTop: 12,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              boxShadow: '0 10px 30px rgba(0,0,0,.25)',
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <strong>{modelBuckets.find((b) => b.id === activeModelBucket)?.label}</strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  onClick={() => selectAllInBucket(activeModelBucket)}
                >
                  Seleccionar todo
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  onClick={() => clearBucket(activeModelBucket)}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <input
                className="input"
                placeholder="Buscar modelo…"
                value={searchByBucket[activeModelBucket] || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchByBucket((prev) => ({ ...prev, [activeModelBucket]: value }))
                  setPageByBucket((prev) => ({ ...prev, [activeModelBucket]: 1 }))
                }}
                style={{ maxWidth: 320 }}
              />
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 8 }}>
              {(() => {
                const rows = filteredBucketRows[activeModelBucket] || []
                const page = pageByBucket[activeModelBucket] || 1
                const start = (page - 1) * PAGE_SIZE
                const pageRows = rows.slice(start, start + PAGE_SIZE)
                return pageRows.map((row) => {
                  const checked = (modelMenuLocal[activeModelBucket] || []).includes(row.id)
                  return (
                    <label
                      key={`${activeModelBucket}-${row.id}`}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: '8px 10px',
                        border: '1px solid var(--hairline)',
                        borderRadius: 'var(--radius-sm)',
                        background: checked
                          ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))'
                          : 'var(--surface-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModelInBucket(activeModelBucket, row.id)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
                          {modelLabel(row)}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block' }}>
                          {modelSearchPrice(row)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-faint)' }}>
                          {row.id}
                        </span>
                      </span>
                    </label>
                  )
                })
              })()}
            </div>

            {(() => {
              const rows = filteredBucketRows[activeModelBucket] || []
              const page = pageByBucket[activeModelBucket] || 1
              const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
              return (
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {rows.length} resultados · página {page}/{maxPage}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-xs"
                      disabled={page <= 1}
                      onClick={() =>
                        setPageByBucket((prev) => ({ ...prev, [activeModelBucket]: Math.max(1, page - 1) }))
                      }
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      disabled={page >= maxPage}
                      onClick={() =>
                        setPageByBucket((prev) => ({ ...prev, [activeModelBucket]: Math.min(maxPage, page + 1) }))
                      }
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="adm-section-header" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              Tabla comparativa de precios
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              Última actualización: {pricingUpdatedLabel}
            </p>
          </div>
          <button className="btn btn-accent btn-sm" onClick={refreshPricingTable} disabled={refreshingPricing}>
            <AdminIcon.Refresh /> {refreshingPricing ? 'Actualizando…' : 'Actualizar precios y modelos'}
          </button>
        </div>
        {pricingLoading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando precios…</p>
        ) : (
          <div className="adm-table-wrap" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Proveedor</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Entrada / 1M</th>
                  <th>Salida / 1M</th>
                  <th>Total / 1M</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{modelLabel(row)}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-faint)' }}>
                        {row.id}
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{row.vendor}</td>
                    <td style={{ textTransform: 'capitalize' }}>{row.category}</td>
                    <td>
                      <span className={`adm-pill adm-pill--${row.status === 'ga' ? 'success' : 'warning'}`}>
                        <span className="adm-pill-dot" />
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{fmtMoney(row.inputPerM)}</td>
                    <td>{fmtMoney(row.outputPerM)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtMoney(row.totalPerM)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   CREDITS PAGE
   ========================================================= */
function CreditsPage() {
  const { creditConfig, setCreditConfig } = useAdmin()
  const toast = useToast()
  const [local, setLocal] = useState({ ...creditConfig })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal({ ...creditConfig }) }, [creditConfig])

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'signup_credits', value: local }),
      })
      setCreditConfig({ ...local })
      toast('Configuración guardada correctamente', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }
  function reset() { setLocal({ ...creditConfig }) }
  function field(key, value) { setLocal(prev => ({ ...prev, [key]: value })) }

  const budgetPct = Math.min(100, (local.currentTotalGiven / (local.maxTotalBudget || 1)) * 100)
  const isDirty   = JSON.stringify(local) !== JSON.stringify(creditConfig)

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Configuración</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Créditos de prueba gratuitos</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>Gestiona los créditos que se otorgan automáticamente al registrarse.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isDirty && <button className="btn btn-ghost btn-sm" onClick={reset}>Cancelar</button>}
          <button className="btn btn-accent btn-sm" onClick={save} disabled={saving || !isDirty} style={{ opacity: isDirty && !saving ? 1 : 0.55 }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="card" style={{
        padding: 24, marginBottom: 16,
        background: local.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--surface-2) 80%, var(--surface))',
        borderColor: local.enabled ? 'var(--border)' : 'var(--hairline)',
        transition: 'all 250ms var(--ease)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0,
            background: local.enabled ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))' : 'var(--surface-3)',
            color: local.enabled ? 'var(--accent)' : 'var(--text-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 250ms',
          }}>
            <AdminIcon.Bolt width="20" height="20" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Créditos de prueba al registro</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Nuevos usuarios reciben créditos automáticamente al crear su cuenta.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <Toggle checked={local.enabled} onChange={v => field('enabled', v)} />
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: local.enabled ? 'var(--success)' : 'var(--text-faint)' }}>
              {local.enabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16, opacity: local.enabled ? 1 : 0.45, pointerEvents: local.enabled ? 'auto' : 'none', transition: 'opacity 250ms' }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>Cantidad y límites</div>
        <div className="adm-page-grid-2">
          {[
            { key: 'creditsOnRegister', label: 'Créditos al registrarse',  hint: 'Créditos que recibe cada nuevo usuario.',                                                               min: 1,   max: 200   },
            { key: 'maxPerUser',        label: 'Máximo por usuario',        hint: 'Tope total de créditos gratis acumulables por cuenta.',                                                 min: 1,   max: 500   },
            { key: 'expiresAfterDays',  label: 'Caducidad (días)',          hint: 'Días hasta que los créditos de prueba expiran sin uso.',                                                min: 1,   max: 365   },
            { key: 'maxTotalBudget',    label: 'Presupuesto máximo total',  hint: 'Límite global de créditos gratis a repartir. Al alcanzarlo, se pausan automáticamente.',               min: 100, max: 99999 },
          ].map(f => (
            <div key={f.key} className="adm-form-group">
              <label className="label">{f.label}</label>
              <input
                className="input"
                type="number"
                min={f.min} max={f.max}
                value={local[f.key]}
                onChange={e => field(f.key, Math.max(f.min, parseInt(e.target.value) || f.min))}
              />
              <span className="form-hint">{f.hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: 4 }}>Presupuesto global utilizado</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              <strong style={{ color: 'var(--text)' }}>{local.currentTotalGiven.toLocaleString('es-ES')}</strong> créditos repartidos de {local.maxTotalBudget.toLocaleString('es-ES')} máximos
            </p>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em',
            color: budgetPct > 85 ? 'var(--danger)' : budgetPct > 65 ? 'var(--warning)' : 'var(--success)',
          }}>
            {budgetPct.toFixed(1)}%
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', borderRadius: 5, transition: 'width 600ms var(--ease), background 400ms',
            width: `${budgetPct}%`,
            background: budgetPct > 85 ? 'var(--danger)' : budgetPct > 65 ? 'var(--warning)' : 'var(--accent-grad)',
          }} />
        </div>
        {budgetPct > 85 && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--danger) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--border))', fontSize: 13, color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AdminIcon.Alert style={{ flexShrink: 0, marginTop: 1 }} />
            <span>El presupuesto está casi agotado. Considera aumentar el límite o desactivar los créditos gratuitos temporalmente.</span>
          </div>
        )}
      </div>

      <CreditCalculator />
    </div>
  )
}

/* =========================================================
   MAINTENANCE PAGE
   ========================================================= */
function MaintenancePage() {
  const { maintenanceConfig, setMaintenanceConfig } = useAdmin()
  const { lang } = useApp() || { lang: 'en' }
  const dict = (SK_I18N[lang] ?? SK_I18N.en) || SK_I18N.en
  const toast = useToast()
  const [local, setLocal]     = useState({ ...maintenanceConfig })
  const [preview, setPreview] = useState(false)

  function save() {
    setMaintenanceConfig({ ...local })
    toast(local.enabled ? '⚠ Plataforma en mantenimiento' : 'Mantenimiento desactivado', local.enabled ? 'error' : 'success')
  }
  function field(key, value) { setLocal(prev => ({ ...prev, [key]: value })) }
  const isDirty = JSON.stringify(local) !== JSON.stringify(maintenanceConfig)

  const getTranslation = (key) => dict[key] || key
  const defaultTitle = getTranslation('maintenance.title.default')
  const defaultMessage = getTranslation('maintenance.message.default')
  const estimatedTimeLabel = getTranslation('maintenance.estimatedTime')
  const needHelpLabel = getTranslation('maintenance.needHelp')

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Configuración</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Modo mantenimiento</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>Pausa la plataforma y muestra un mensaje personalizado a los usuarios.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview(v => !v)}>
            <AdminIcon.Eye /> {preview ? 'Ocultar preview' : 'Ver preview'}
          </button>
          {isDirty && <button className="btn btn-ghost btn-sm" onClick={() => setLocal({ ...maintenanceConfig })}>Cancelar</button>}
          <button className="btn btn-accent btn-sm" onClick={save}>Guardar</button>
        </div>
      </div>

      <div className="card" style={{
        padding: 28, marginBottom: 20,
        background: local.enabled ? 'color-mix(in srgb, var(--warning) 7%, var(--surface))' : 'var(--surface)',
        borderColor: local.enabled ? 'color-mix(in srgb, var(--warning) 45%, var(--border))' : 'var(--border)',
        transition: 'background 350ms var(--ease), border-color 350ms var(--ease)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)', flexShrink: 0,
            background: local.enabled ? 'color-mix(in srgb, var(--warning) 18%, var(--surface-2))' : 'var(--surface-2)',
            color: local.enabled ? 'var(--warning)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 350ms var(--ease)',
          }}>
            <AdminIcon.Tool width="24" height="24" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 5 }}>Poner plataforma en mantenimiento</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {local.enabled
                ? 'La plataforma está PAUSADA. Los usuarios ven la página de mantenimiento.'
                : 'La plataforma está operativa. Activa el mantenimiento para pausarla.'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
            <Toggle checked={local.enabled} onChange={v => field('enabled', v)} />
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: local.enabled ? 'var(--warning)' : 'var(--text-faint)',
            }}>
              {local.enabled ? '● Activo' : '○ Inactivo'}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>Mensaje para los usuarios</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-form-group">
            <label className="label">Título</label>
            <input className="input" type="text" value={local.title} onChange={e => field('title', e.target.value)} placeholder={defaultTitle} />
          </div>
          <div className="adm-form-group">
            <label className="label">Mensaje</label>
            <textarea className="input" rows={3} style={{ resize: 'vertical', minHeight: 80 }} value={local.message} onChange={e => field('message', e.target.value)} placeholder={defaultMessage} />
          </div>
          <div className="adm-page-grid-2">
            <div className="adm-form-group">
              <label className="label">{estimatedTimeLabel} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="input" type="text" value={local.estimatedTime} onChange={e => field('estimatedTime', e.target.value)} placeholder="Ej: 2 horas, 30 minutos…" />
            </div>
            <div className="adm-form-group">
              <label className="label">Email de contacto</label>
              <input className="input" type="email" value={local.contactEmail} onChange={e => field('contactEmail', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AdminIcon.Eye /> Preview — página que verían los usuarios
          </div>
          <div style={{ padding: '56px 40px', textAlign: 'center', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 'var(--radius-xl)', background: 'color-mix(in srgb, var(--warning) 14%, var(--surface-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', marginBottom: 6 }}>
              <AdminIcon.Tool width="28" height="28" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', maxWidth: 420 }}>
              {local.title || 'Título del mantenimiento'}
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.65, margin: 0 }}>
              {local.message || 'Mensaje de mantenimiento…'}
            </p>
            {local.estimatedTime && (
              <div style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AdminIcon.Clock style={{ color: 'var(--text-muted)' }} /> {estimatedTimeLabel}: {local.estimatedTime}
              </div>
            )}
            {local.contactEmail && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                {needHelpLabel} <a style={{ color: 'var(--accent)' }} href={`mailto:${local.contactEmail}`}>{local.contactEmail}</a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   USERS PAGE
   ========================================================= */
function UsersPage() {
  const { users, setUsers, usersLoading } = useAdmin()
  const toast = useToast()
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState('all')
  const [confirm,      setConfirm]      = useState(null)
  // Credit assignment state: { id, value }
  const [creditModal,  setCreditModal]  = useState(null)
  const [creditBusy,   setCreditBusy]   = useState(false)

  function applyToggle(id) {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u
      const next = u.status === 'active' ? 'disabled' : 'active'
      return { ...u, status: next }
    }))
    const u = users.find(x => x.id === id)
    const next = u?.status === 'active' ? 'deshabilitada' : 'habilitada'
    toast(`Cuenta ${next} correctamente`, u?.status === 'active' ? 'error' : 'success')
    setConfirm(null)
  }

  async function applyCredits() {
    if (!creditModal) return
    const amount = Number(creditModal.value)
    if (!Number.isFinite(amount) || amount < 0) {
      toast('Introduce una cantidad válida', 'error'); return
    }
    setCreditBusy(true)
    try {
      await apiFetch(`/api/admin/users/${creditModal.id}/credits`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: amount }),
      })
      setUsers(prev => prev.map(u => u.id === creditModal.id ? { ...u, credits: amount } : u))
      toast(`Créditos asignados: ${amount}`, 'success')
      setCreditModal(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al asignar créditos', 'error')
    } finally {
      setCreditBusy(false)
    }
  }

  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => u.status === 'active').length,
    pro:      users.filter(u => u.plan === 'pro').length,
    disabled: users.filter(u => u.status === 'disabled').length,
  }), [users])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter(u => {
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const matchFilter =
        filter === 'all'      ? true :
        filter === 'pro'      ? u.plan === 'pro' :
        filter === 'free'     ? u.plan === 'free' :
        filter === 'disabled' ? u.status === 'disabled' : true
      return matchSearch && matchFilter
    })
  }, [users, search, filter])

  const filterTabs = [
    { id: 'all',      label: 'Todos',          val: stats.total,                    accent: 'var(--text-muted)' },
    { id: 'pro',      label: 'Pro',            val: stats.pro,                      accent: 'var(--accent)' },
    { id: 'free',     label: 'Free',           val: stats.active - stats.pro,       accent: 'var(--success)' },
    { id: 'disabled', label: 'Deshabilitados', val: stats.disabled,                 accent: 'var(--danger)' },
  ]

  function avatarColor(name) {
    const hues = [210, 250, 280, 160, 35, 195, 320, 340]
    const idx  = name.charCodeAt(0) % hues.length
    return `oklch(0.52 0.18 ${hues[idx]})`
  }

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Gestión</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Usuarios</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>{users.length} cuentas registradas en la plataforma.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {filterTabs.map(s => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id === filter ? 'all' : s.id)}
            style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              textAlign: 'left', transition: 'all 160ms var(--ease)',
              background: filter === s.id ? `color-mix(in srgb, ${s.accent} 10%, var(--surface))` : 'var(--surface)',
              border: `1px solid ${filter === s.id ? `color-mix(in srgb, ${s.accent} 45%, var(--border))` : 'var(--border)'}`,
            }}
          >
            <div style={{ fontSize: 11, color: s.accent, marginBottom: 5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>{s.val}</div>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <AdminIcon.Search style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="input"
          style={{ paddingLeft: 38 }}
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="adm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Plan</th>
              <th>Créditos</th>
              <th>Último acceso</th>
              <th>Registrado</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Créditos</th>
              <th style={{ textAlign: 'right' }}>Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {usersLoading && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 14 }}>
                  Cargando usuarios…
                </td>
              </tr>
            )}
            {!usersLoading && filtered.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 14 }}>
                  No se encontraron usuarios
                </td>
              </tr>
            )}
            {!usersLoading && filtered.map(u => (
              <tr key={u.id} style={{ opacity: u.status === 'disabled' ? 0.55 : 1, transition: 'opacity 200ms' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="adm-user-avatar" style={{ background: u.status === 'disabled' ? 'var(--surface-3)' : avatarColor(u.name) }}>
                      {u.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.3 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={u.plan === 'pro' ? 'adm-pill adm-pill--accent' : 'adm-pill adm-pill--free'}>
                    {u.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {u.credits}<span style={{ color: 'var(--text-muted)', fontSize: 11 }}> cr</span>
                  </span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.lastActive}</td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.joined}</td>
                <td>
                  <span className={`adm-pill ${u.status === 'active' ? 'adm-pill--success' : 'adm-pill--danger'}`}>
                    <span className="adm-pill-dot" />
                    {u.status === 'active' ? 'Activo' : 'Deshabilitado'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {creditModal && creditModal.id === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number" min={0} max={99999}
                          value={creditModal.value}
                          onChange={e => setCreditModal(m => ({ ...m, value: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') applyCredits(); if (e.key === 'Escape') setCreditModal(null) }}
                          autoFocus
                          style={{ width: 72, padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right' }}
                        />
                        <button className="btn btn-xs btn-accent" onClick={applyCredits} disabled={creditBusy}>
                          {creditBusy ? '…' : 'OK'}
                        </button>
                        <button className="btn btn-xs btn-ghost" onClick={() => setCreditModal(null)}>✕</button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-xs btn-ghost"
                        style={{ gap: 5 }}
                        onClick={() => setCreditModal({ id: u.id, value: String(u.credits ?? 0) })}
                        title="Asignar créditos"
                      >
                        <AdminIcon.Bolt /><span>Asignar cr.</span>
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {confirm && confirm.id === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>¿Confirmar?</span>
                        <button className="btn btn-xs btn-danger" onClick={() => applyToggle(u.id)}>Sí</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => setConfirm(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className={`btn btn-xs ${u.status === 'active' ? 'btn-danger' : 'btn-ghost'}`}
                        style={{ gap: 5 }}
                        onClick={() => u.status === 'active' ? setConfirm({ id: u.id }) : applyToggle(u.id)}
                      >
                        {u.status === 'active'
                          ? <><AdminIcon.UserX /><span>Deshabilitar</span></>
                          : <><AdminIcon.UserCheck /><span>Habilitar</span></>}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          {filtered.length} de {users.length} usuarios
        </div>
      )}
    </div>
  )
}

/* =========================================================
   STATS PAGE
   ========================================================= */
function StatsPage() {
  const { users } = useAdmin()
  const [period, setPeriod] = useState(6)
  const proUsers  = users.filter(u => u.plan !== 'free').length
  const freeUsers = users.filter(u => u.plan === 'free').length
  const totalCredits = users.reduce((s, u) => s + (u.credits || 0), 0)

  const planSegs = [
    { label: 'Pro',  value: proUsers,  color: 'var(--accent)' },
    { label: 'Free', value: freeUsers, color: 'var(--surface-3)' },
  ]
  const revSegs = [
    { label: 'Suscripciones', value: 0, color: 'var(--accent)' },
    { label: 'Recargas',      value: 0, color: 'var(--accent-2)' },
  ]

  const allUsers = users.length
  const totRev = 0   // sin datos de Stripe todavía

  const kpis = [
    { label: 'Usuarios totales',     value: users.length.toLocaleString('es-ES'), delta: null, icon: AdminIcon.Users,      accent: 'var(--accent)' },
    { label: 'Suscriptores de pago', value: proUsers.toLocaleString('es-ES'),     delta: null, icon: AdminIcon.CreditCard, accent: 'var(--accent-2)' },
    { label: 'Créditos en uso',      value: totalCredits.toLocaleString('es-ES'), delta: null, icon: AdminIcon.Bolt,       accent: 'var(--success)' },
    { label: 'MRR',                  value: '—',                                  delta: null, icon: AdminIcon.EuroSign,   accent: 'var(--warning)' },
  ]

  // Agrupar usuarios reales por mes para los gráficos
  const data = useMemo(() => {
    const monthsBack = period === 7 ? 24 : period
    const months = []
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      months.push({ key, month: label, newUsers: 0, newSubs: 0, credits: 0, revenue: 0, creditRevenue: 0 })
    }
    users.forEach(u => {
      const created = u.created_at ? new Date(u.created_at) : null
      if (!created) return
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`
      const row = months.find(m => m.key === key)
      if (!row) return
      row.newUsers += 1
      if (u.plan !== 'free') row.newSubs += 1
    })
    return months
  }, [users, period])

  const chartCard = (eyebrow, title, children) => (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
        <h3 style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div>
      <div className="adm-section-header">
        <div>
          <span className="eyebrow">Analíticas</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Estadísticas</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>Métricas de crecimiento y monetización de la plataforma.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[3, 6, 7].map(m => (
            <button key={m} className={`btn btn-sm ${period === m ? 'btn-subtle' : 'btn-ghost'}`} onClick={() => setPeriod(m)}>
              {m === 7 ? 'Todo' : `${m}M`}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-stat-grid" style={{ marginBottom: 24 }}>
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      <div className="adm-page-grid-2" style={{ marginBottom: 20 }}>
        {chartCard('Crecimiento', 'Nuevos registros por mes',
          <LineAreaChart data={data.map(d => ({ label: d.month, value: d.newUsers }))} colorLine="var(--accent)" height={145} />
        )}
        {chartCard('Conversión', 'Nuevas suscripciones Pro',
          <LineAreaChart data={data.map(d => ({ label: d.month, value: d.newSubs }))} colorLine="var(--accent-2)" height={145} />
        )}
      </div>

      <div className="adm-page-grid-2" style={{ marginBottom: 20 }}>
        {chartCard('Monetización', 'Créditos comprados',
          <BarChart data={data.map(d => ({ label: d.month, value: d.credits }))} color="var(--success)" height={145} />
        )}
        {chartCard('Ingresos', 'Facturación mensual (€)',
          <LineAreaChart
            data={data.map(d => ({ label: d.month, value: d.revenue }))}
            colorLine="var(--warning)" height={145}
            formatY={v => `€${Math.round(v).toLocaleString('es-ES')}`}
          />
        )}
      </div>

      <div className="adm-page-grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Distribución</div>
          <h3 style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: 20 }}>Tipos de cuenta (acumulado)</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <DonutChart segments={planSegs} size={120} centerLabel={allUsers} centerSub="usuarios" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {planSegs.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.value} · {allUsers > 0 ? Math.round((s.value / allUsers) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Desglose</div>
          <h3 style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: 20 }}>Fuentes de ingreso del período</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <DonutChart segments={revSegs} size={120} centerLabel={`€${totRev.toLocaleString('es-ES')}`} centerSub="total" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {revSegs.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      €{s.value.toLocaleString('es-ES')} · {totRev > 0 ? Math.round((s.value / totRev) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Resumen mensual</h3>
        </div>
        <div className="adm-table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Nuevos usuarios</th>
                <th>Nuevas suscripciones</th>
                <th>Créditos vendidos</th>
                <th>Ingresos suscripciones</th>
                <th>Ingresos recargas</th>
                <th>Total €</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{d.month}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{d.newUsers.toLocaleString('es-ES')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{d.newSubs.toLocaleString('es-ES')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{d.credits.toLocaleString('es-ES')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>€{(d.revenue - d.creditRevenue).toLocaleString('es-ES')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>€{d.creditRevenue.toLocaleString('es-ES')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success)' }}>€{d.revenue.toLocaleString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   CREDIT CALCULATOR
   ========================================================= */
function CreditCalculator() {
  const [euros, setEuros] = useState(10)
  const credits = Math.round(euros * EUR_TO_CREDITS)

  const rows = useMemo(() => {
    return MODELS.map((m) => {
      const creditsPerReq = MODEL_CREDITS_PER_REQUEST[m.id] ?? 1
      const requests = Math.floor(credits / creditsPerReq)
      const mInput = credits / (m.runlabsInputPerM ?? 1)
      const mOutput = credits / (m.runlabsOutputPerM ?? 1)
      return { m, requests, mInput, mOutput }
    })
  }, [credits])

  return (
    <div className="card" style={{ padding: 24, marginTop: 16 }}>
      <div className="adm-section-header" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow">Referencia</span>
          <h2 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: '-0.028em' }}>Calculadora de créditos</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>¿Cuánto puede hacer un usuario con su presupuesto?</p>
        </div>
      </div>

      <div className="pricing-calc-control" style={{ marginBottom: 24 }}>
        <label className="pricing-calc-label" htmlFor="adm-calc-euros">Presupuesto</label>
        <div className="pricing-calc-input-row">
          <input
            id="adm-calc-euros"
            type="number"
            min={1} max={10000} step={1}
            value={euros}
            onChange={(e) => setEuros(Math.max(1, Number(e.target.value) || 1))}
            className="pricing-calc-input"
          />
          <span className="pricing-calc-currency">€</span>
          <span className="pricing-calc-credits-badge">
            = <strong>{credits.toLocaleString()}</strong> créditos
          </span>
        </div>
        <input
          type="range" min={1} max={500} step={1}
          value={Math.min(euros, 500)}
          onChange={(e) => setEuros(Number(e.target.value))}
          className="pricing-calc-slider"
          aria-label="Ajustar presupuesto"
        />
      </div>

      <div className="pricing-calc-table">
        <div className="pricing-calc-table-head mono">
          <span>Modelo</span>
          <span>Solicitudes</span>
          <span>M tokens entrada</span>
          <span>M tokens salida</span>
        </div>
        {rows.map(({ m, requests, mInput, mOutput }) => (
          <div key={m.id} className="pricing-calc-row">
            <div className="pricing-api-model">
              <span className="pricing-api-dot" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
              <span>{m.name}</span>
            </div>
            <span className="mono">{requests.toLocaleString()}</span>
            <span className="mono">{mInput.toFixed(2)} M</span>
            <span className="mono">{mOutput.toFixed(2)} M</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   NAV ITEMS
   ========================================================= */
const NAV_ITEMS = [
  { id: 'overview',     label: 'Resumen',         Icon: AdminIcon.Grid     },
  { id: 'credits',      label: 'Créditos gratis', Icon: AdminIcon.Bolt     },
  { id: 'features',     label: 'Funciones',       Icon: AdminIcon.Mic      },
  { id: 'models',       label: 'Modelos IA',      Icon: AdminIcon.Search   },
  { id: 'maintenance',  label: 'Mantenimiento',   Icon: AdminIcon.Tool     },
  { id: 'users',        label: 'Usuarios',        Icon: AdminIcon.Users    },
  { id: 'stats',        label: 'Estadísticas',    Icon: AdminIcon.BarChart2 },
]

/* =========================================================
   SIDEBAR
   ========================================================= */
function AdminSidebar({ section, setSection, theme, setTheme, maintenanceConfig, profile }) {
  return (
    <aside className="adm-sidebar">
      <div className="adm-sidebar-brand">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.025em' }}>
          Runlabs<span className="brand-42">42</span>
        </span>
        <span className="adm-badge">admin</span>
      </div>

      <nav className="adm-nav">
        <div style={{ padding: '6px 4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-faint)' }}>
          Navegación
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`adm-nav-item${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            <item.Icon />
            <span>{item.label}</span>
            {item.id === 'maintenance' && maintenanceConfig.enabled && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="adm-sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 4px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {(profile?.fullName?.[0] || profile?.email?.[0] || 'A').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.fullName || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.email || ''}
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start', gap: 8, fontSize: 13 }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <AdminIcon.Sun /> : <AdminIcon.Moon />}
          {theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        </button>
      </div>
    </aside>
  )
}

/* =========================================================
   TOPBAR
   ========================================================= */
function AdminTopbar({ section, maintenanceConfig, setSection, profile }) {
  const current = NAV_ITEMS.find(n => n.id === section)
  return (
    <header className="adm-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {current && <current.Icon style={{ color: 'var(--text-muted)' }} />}
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{current?.label}</span>
      </div>
      <div style={{ flex: 1 }} />
      {maintenanceConfig.enabled && (
        <button
          onClick={() => setSection('maintenance')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--warning) 12%, var(--surface))',
            border: '1px solid color-mix(in srgb, var(--warning) 35%, var(--border))',
            fontSize: 12, fontWeight: 500, color: 'var(--warning)', cursor: 'pointer',
          }}
        >
          <AdminIcon.Alert />
          Mantenimiento activo
        </button>
      )}
      <div style={{ width: 1, height: 22, background: 'var(--hairline)', margin: '0 8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
          {(profile?.fullName?.[0] || profile?.email?.[0] || 'A').toUpperCase()}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{profile?.fullName || 'Admin'}</span>
        <AdminIcon.ChevronDown style={{ color: 'var(--text-muted)' }} />
      </div>
    </header>
  )
}

/* =========================================================
   ADMIN LAYOUT
   ========================================================= */
function AdminLayout({ profile }) {
  const { section, setSection, theme, setTheme, maintenanceConfig } = useAdmin()

  const pages = {
    overview:    <OverviewPage />,
    credits:     <CreditsPage />,
    features:    <FeaturesPage />,
    models:      <ModelsPage />,
    maintenance: <MaintenancePage />,
    users:       <UsersPage />,
    stats:       <StatsPage />,
  }

  return (
    <div className="adm-layout">
      <AdminSidebar
        section={section}
        setSection={setSection}
        theme={theme}
        setTheme={setTheme}
        maintenanceConfig={maintenanceConfig}
        profile={profile}
      />
      <div className="adm-main">
        <AdminTopbar
          section={section}
          maintenanceConfig={maintenanceConfig}
          setSection={setSection}
          profile={profile}
        />
        <main className="adm-content fadein" key={section}>
          {pages[section] || pages.overview}
        </main>
      </div>
    </div>
  )
}

/* =========================================================
   ACCESS DENIED
   ========================================================= */
function AccessDenied({ router }) {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--bg)', color: 'var(--text)',
    }}>
      <div style={{ color: 'var(--text-faint)' }}>
        <AdminIcon.Lock />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
        Acceso restringido
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
        Esta sección es solo para administradores.
      </p>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')} style={{ marginTop: 8, gap: 8 }}>
        <AdminIcon.ArrowLeft /> Volver al inicio
      </button>
    </div>
  )
}

/* =========================================================
   ROOT EXPORT
   ========================================================= */
export function AdminPage() {
  const router           = useRouter()
  const { profile, loading } = useUser()

  const [section,           setSection]           = useState('overview')
  const [theme,             setTheme]             = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    try { return localStorage.getItem('sk.theme') || 'dark' } catch { return 'dark' }
  })
  const [creditConfig,      setCreditConfig]      = useState(INITIAL_CREDIT_CONFIG)
  const [speechDictationConfig, setSpeechDictationConfig] = useState(INITIAL_SPEECH_DICTATION_CONFIG)
  const [designClarifyConfig, setDesignClarifyConfig] = useState(INITIAL_DESIGN_CLARIFY_CONFIG)
  const [designImageGenerationConfig, setDesignImageGenerationConfig] = useState(
    INITIAL_DESIGN_IMAGE_GENERATION_CONFIG,
  )
  const [designImageModelConfig, setDesignImageModelConfig] = useState(INITIAL_DESIGN_IMAGE_MODEL_CONFIG)
  const [vertexGeminiBatchConfig, setVertexGeminiBatchConfig] = useState(INITIAL_VERTEX_GEMINI_BATCH_CONFIG)
  const [vertexContextCacheConfig, setVertexContextCacheConfig] = useState(
    INITIAL_VERTEX_CONTEXT_CACHE_CONFIG,
  )
  const [modelMenuVisibilityConfig, setModelMenuVisibilityConfig] = useState(
    EMPTY_MODEL_MENU_VISIBILITY,
  )
  const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
    if (typeof window === 'undefined') return INITIAL_MAINTENANCE_CONFIG
    try {
      const stored = localStorage.getItem('adm.maintenanceConfig')
      return stored ? JSON.parse(stored) : INITIAL_MAINTENANCE_CONFIG
    } catch { return INITIAL_MAINTENANCE_CONFIG }
  })
  const [users,             setUsers]             = useState([])
  const [usersLoading,      setUsersLoading]      = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('sk.theme', theme) } catch {}
  }, [theme])

  // Load credit config from Supabase on mount (only when admin is confirmed)
  const isAdmin = profile && isAdminEmail(profile.email)
  useEffect(() => {
    if (!isAdmin) return
    apiFetch('/api/admin/settings')
      .then((data) => {
        const cfg = data?.settings?.signup_credits
        if (cfg) setCreditConfig(prev => ({ ...prev, ...cfg }))
        const speech = data?.settings?.[SPEECH_DICTATION_SETTING_KEY]
        setSpeechDictationConfig((prev) => ({
          ...prev,
          enabled: parseSpeechDictationEnabled(speech),
        }))
        const designClarify = data?.settings?.[DESIGN_CLARIFY_QUESTIONS_SETTING_KEY]
        setDesignClarifyConfig({
          enabled: parseDesignClarifyQuestionsEnabled(designClarify),
        })
        const designImageGen = data?.settings?.design_image_generation
        setDesignImageGenerationConfig({
          enabled: parseDesignImageGenerationEnabled(designImageGen),
        })
        const designImage = data?.settings?.design_image_model
        setDesignImageModelConfig(parseDesignImageModelSetting(designImage))
        const vertexBatch = data?.settings?.vertex_gemini_batch_api
        setVertexGeminiBatchConfig({
          enabled: parseVertexGeminiBatchEnabled(vertexBatch),
        })
        const vertexContextCache = data?.settings?.vertex_context_cache
        setVertexContextCacheConfig(parseVertexContextCacheSetting(vertexContextCache))
        const modelVisibility = data?.settings?.[MODEL_MENU_VISIBILITY_SETTING_KEY]
        setModelMenuVisibilityConfig(parseModelMenuVisibility(modelVisibility, []))
      })
      .catch(() => { /* keep defaults if API fails */ })
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    setUsersLoading(true)
    apiFetch('/api/admin/users')
      .then((data) => { if (data?.users) setUsers(data.users) })
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }, [isAdmin])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cargando…</div>
      </div>
    )
  }

  if (!isAdmin) return <AccessDenied router={router} />

  const ctx = {
    section, setSection,
    theme, setTheme,
    creditConfig, setCreditConfig,
    speechDictationConfig, setSpeechDictationConfig,
    designClarifyConfig, setDesignClarifyConfig,
    designImageGenerationConfig, setDesignImageGenerationConfig,
    designImageModelConfig, setDesignImageModelConfig,
    vertexGeminiBatchConfig, setVertexGeminiBatchConfig,
    vertexContextCacheConfig, setVertexContextCacheConfig,
    modelMenuVisibilityConfig, setModelMenuVisibilityConfig,
    maintenanceConfig, setMaintenanceConfig,
    users, setUsers,
    usersLoading,
  }

  return (
    <AdminCtx.Provider value={ctx}>
      <ToastProvider>
        <AdminLayout profile={profile} />
      </ToastProvider>
    </AdminCtx.Provider>
  )
}
