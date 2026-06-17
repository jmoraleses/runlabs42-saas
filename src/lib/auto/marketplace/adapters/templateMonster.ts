import 'server-only'

import type { MarketplaceListing } from '@/lib/auto/marketplace/generateListingMetadata'
import type { AutoRunSend } from '@/lib/auto/types'

export type TemplateMonsterSubmitResult = {
  status: 'prepared' | 'submitted' | 'awaiting-confirm'
  message: string
  draftUrl?: string
  formFields?: Record<string, string>
}

const TM_AUTH_URL = 'https://account.templatemonster.com/auth/sign-in'
const TM_UPLOAD_HINT = 'https://www.templatemonster.com/'

function buildFormFields(listing: MarketplaceListing): Record<string, string> {
  return {
    title: listing.title,
    shortDescription: listing.shortDescription,
    description: listing.description,
    tags: listing.tags.join(', '),
    category: listing.category,
    price: String(listing.suggestedPriceUsd),
    compatibility: listing.compatibility.join(', '),
    features: listing.features.join('\n'),
  }
}

export async function runTemplateMonsterPublisher(opts: {
  listing: MarketplaceListing
  packagePath: string
  publishMode: 'assist' | 'auto'
  send: AutoRunSend
  variantId: string
  projectId?: string
}): Promise<TemplateMonsterSubmitResult> {
  const user = process.env.TEMPLATEMONSTER_AUTHOR_EMAIL?.trim()
  const pass = process.env.TEMPLATEMONSTER_AUTHOR_PASSWORD?.trim()
  const formFields = buildFormFields(opts.listing)

  opts.send({
    phase: 'marketplace-fill-upload',
    message: 'Preparando ficha TemplateMonster…',
    variantId: opts.variantId,
  })

  if (!user || !pass) {
    return {
      status: 'awaiting-confirm',
      message:
        'Paquete listo. Configura TEMPLATEMONSTER_AUTHOR_EMAIL y TEMPLATEMONSTER_AUTHOR_PASSWORD para login automático, o confirma para marcar como preparado.',
      formFields,
    }
  }

  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: process.env.TM_HEADLESS !== '0' })
    const context = await browser.newContext()
    const page = await context.newPage()

    opts.send({
      phase: 'marketplace-fill-upload',
      message: 'Iniciando sesión en TemplateMonster…',
      variantId: opts.variantId,
    })

    await page.goto(TM_AUTH_URL, { timeout: 45_000, waitUntil: 'domcontentloaded' })
    const emailSel = 'input[type="email"], input[name="email"], #email'
    const passSel = 'input[type="password"], input[name="password"], #password'
    if (await page.locator(emailSel).first().isVisible().catch(() => false)) {
      await page.locator(emailSel).first().fill(user)
      await page.locator(passSel).first().fill(pass)
      const submit = page.locator('button[type="submit"], input[type="submit"]').first()
      if (await submit.isVisible().catch(() => false)) {
        await submit.click()
        await page.waitForTimeout(3000)
      }
    }

    await page.goto(TM_UPLOAD_HINT, { timeout: 30_000, waitUntil: 'domcontentloaded' }).catch(() => null)

    await browser.close()

    if (opts.publishMode === 'auto') {
      return {
        status: 'awaiting-confirm',
        message:
          'Sesión iniciada (si las credenciales son válidas). La subida final requiere confirmación en modo assist.',
        formFields,
        draftUrl: TM_UPLOAD_HINT,
      }
    }

    return {
      status: 'awaiting-confirm',
      message: `Login intentado. Revisa el paquete ${opts.packagePath} y confirma la publicación asistida.`,
      formFields,
      draftUrl: page.url(),
    }
  } catch (e) {
    return {
      status: 'prepared',
      message: e instanceof Error ? e.message : 'Playwright no disponible',
      formFields,
    }
  }
}
