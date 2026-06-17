import { isSupportedLang } from '@/lib/locale'
import { legalCatalog } from '@/lib/legal/catalog'
import type { LegalDocId, LegalDocument } from '@/lib/legal/types'

export function getLegalDocument(docId: LegalDocId, lang: string): LegalDocument {
  const code = isSupportedLang(lang) ? lang : 'en'
  return legalCatalog[code][docId]
}

export function getLegalDocTitle(docId: LegalDocId, lang: string): string {
  return getLegalDocument(docId, lang).title
}

export const LEGAL_DOC_IDS: LegalDocId[] = ['privacy', 'cookies', 'terms']

export const LEGAL_ROUTES: Record<LegalDocId, string> = {
  privacy: '/legal/privacy',
  cookies: '/legal/cookies',
  terms: '/legal/terms',
}
