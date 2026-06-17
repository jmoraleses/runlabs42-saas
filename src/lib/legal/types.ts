import type { SupportedLang } from '@/lib/locale'

export type LegalDocId = 'privacy' | 'cookies' | 'terms'

export type LegalSection = {
  id: string
  title: string
  paragraphs: string[]
}

export type LegalDocument = {
  title: string
  subtitle: string
  lastUpdated: string
  acceptanceNotice: string
  sections: LegalSection[]
}

export type LegalContentMap = Record<LegalDocId, LegalDocument>

export type LegalCatalog = Record<SupportedLang, LegalContentMap>
