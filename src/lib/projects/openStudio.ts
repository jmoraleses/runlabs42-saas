'use client'

import { clearPendingEditorSession } from '@/lib/landing/pendingEditorPrompt'
import type { StudioLang } from '@/lib/projects/genericProjectName'

const STUDIO_LANG_KEY = 'studio_lang'
const STUDIO_REENTRY_KEY = 'studio_reentry'
const STUDIO_JUST_CREATED_KEY = 'sk.studio.justCreatedProjectId'
const STUDIO_FRAMEWORK_KEY = 'studio_framework'
/** Próximo commit en Studio debe crear proyecto nuevo (no reutilizar id en memoria). */
const STUDIO_FORCE_NEW_PROJECT_KEY = 'sk.studio.forceNewProject'
/** Próxima generación de diseño debe ignorar design.md/HTML previos del proyecto. */
const STUDIO_REPLACE_DESIGN_KEY = 'sk.studio.replaceDesign'

export type OpenStudioOptions = {
  /** Abrir un proyecto concreto (p. ej. desde la lista de proyectos). */
  projectId?: string | null
}

function buildStudioPath(
  lang: StudioLang,
  projectId?: string | null,
  opts?: { fresh?: boolean },
): string {
  const params = new URLSearchParams()
  if (lang === 'en') params.set('lang', 'en')
  if (projectId) {
    params.set('project', projectId)
  } else if (opts?.fresh !== false) {
    params.set('_studio', String(Date.now()))
  }
  const q = params.toString()
  return `/studio${q ? `?${q}` : ''}`
}

/** Abre el Studio (workspace vacío hasta que el usuario envíe un prompt o añada archivos). */
export function openStudio(
  navigate: (path: string) => void,
  lang: StudioLang = 'es',
  options: OpenStudioOptions = {},
): void {
  const targetProject = options.projectId ?? null

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STUDIO_LANG_KEY, lang)
      window.sessionStorage.setItem(STUDIO_REENTRY_KEY, String(Date.now()))
      if (!targetProject) {
        clearPendingEditorSession()
        window.sessionStorage.setItem(STUDIO_FORCE_NEW_PROJECT_KEY, '1')
        window.sessionStorage.setItem(STUDIO_REPLACE_DESIGN_KEY, '1')
      }
    } catch {
      /* ignore */
    }
  }

  navigate(
    buildStudioPath(lang, targetProject, { fresh: targetProject ? false : true }),
  )
}

export function consumeStudioLangFromSession(): StudioLang | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(STUDIO_LANG_KEY)
    if (v === 'en' || v === 'es') {
      window.sessionStorage.removeItem(STUDIO_LANG_KEY)
      return v
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Token pendiente de reentry (sin consumir). */
export function peekStudioReentryToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STUDIO_REENTRY_KEY)
  } catch {
    return null
  }
}

/** Señal de que el usuario acaba de pulsar Studio (recargar o re-sembrar si hace falta). */
export function consumeStudioReentry(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.sessionStorage.getItem(STUDIO_REENTRY_KEY)
    if (!v) return false
    window.sessionStorage.removeItem(STUDIO_REENTRY_KEY)
    return true
  } catch {
    return false
  }
}

/** Proyecto recién creado desde la landing (acceso inmediato sin esperar otra validación). */
export function markStudioProjectJustCreated(projectId: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STUDIO_JUST_CREATED_KEY, projectId)
  } catch {
    /* ignore */
  }
}

export function consumeStudioProjectJustCreated(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = window.sessionStorage.getItem(STUDIO_JUST_CREATED_KEY)
    window.sessionStorage.removeItem(STUDIO_JUST_CREATED_KEY)
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

export function isStudioProjectJustCreated(projectId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(STUDIO_JUST_CREATED_KEY) === projectId
  } catch {
    return false
  }
}

/** projectId en la URL actual si estamos en Studio (para conservar archivos al reentrar). */
export function studioProjectIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const path = window.location.pathname
    if (path !== '/studio' && !path.startsWith('/studio/')) return null
    return new URLSearchParams(window.location.search).get('project')
  } catch {
    return null
  }
}

/** Framework elegido antes de abrir Studio (p. ej. desde Projects o landing). */
export function markStudioFramework(framework: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STUDIO_FRAMEWORK_KEY, framework)
  } catch {
    /* ignore */
  }
}

export function consumeStudioFramework(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fw = window.sessionStorage.getItem(STUDIO_FRAMEWORK_KEY)
    window.sessionStorage.removeItem(STUDIO_FRAMEWORK_KEY)
    return fw && fw.length > 0 ? fw : null
  } catch {
    return null
  }
}

/** Sesión fresca de Studio: el siguiente commit no debe reutilizar un projectId en memoria. */
export function consumeStudioForceNewProject(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.sessionStorage.getItem(STUDIO_FORCE_NEW_PROJECT_KEY)
    if (v !== '1') return false
    window.sessionStorage.removeItem(STUDIO_FORCE_NEW_PROJECT_KEY)
    return true
  } catch {
    return false
  }
}

/** Sesión fresca de Studio: la próxima generación de diseño empieza sin heredar el sistema visual previo. */
export function consumeStudioReplaceDesign(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.sessionStorage.getItem(STUDIO_REPLACE_DESIGN_KEY)
    if (v !== '1') return false
    window.sessionStorage.removeItem(STUDIO_REPLACE_DESIGN_KEY)
    return true
  } catch {
    return false
  }
}
