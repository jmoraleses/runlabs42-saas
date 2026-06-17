import type { LegalCatalog } from '@/lib/legal/types'
import { enLegal } from '@/lib/legal/content/en'
import { esLegal } from '@/lib/legal/content/es'
import { frLegal } from '@/lib/legal/content/fr'
import { deLegal } from '@/lib/legal/content/de'
import { nlLegal } from '@/lib/legal/content/nl'
import { itLegal } from '@/lib/legal/content/it'

export const legalCatalog: LegalCatalog = {
  en: enLegal,
  es: esLegal,
  fr: frLegal,
  de: deLegal,
  nl: nlLegal,
  it: itLegal,
}
