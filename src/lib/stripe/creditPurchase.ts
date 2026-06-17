/** Compra puntual de créditos (EUR) vía Stripe Checkout. */

export const CREDIT_PURCHASE_MIN_EUR = 15
export const CREDIT_PURCHASE_MAX_EUR = 500
export const CREDIT_PURCHASE_PRESETS_EUR = [15, 40, 80] as const

export type CreditPurchasePresetEur = (typeof CREDIT_PURCHASE_PRESETS_EUR)[number]

/** Packs fijos: 15€→100, 40€→250, 80€→500 créditos. */
const CREDIT_PACK_BY_EUR: Record<number, number> = {
  15: 100,
  40: 250,
  80: 500,
}

export function creditsForEur(amountEur: number): number {
  const pack = CREDIT_PACK_BY_EUR[amountEur]
  if (pack != null) return pack
  // Entre packs: misma tasa que 80€ (6,25 cr/€).
  return Math.round(amountEur * 6.25)
}

export function amountEurToCents(amountEur: number): number {
  return Math.round(amountEur * 100)
}

export function parsePurchaseAmountEur(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n * 100) / 100
  if (rounded < CREDIT_PURCHASE_MIN_EUR || rounded > CREDIT_PURCHASE_MAX_EUR) return null
  return rounded
}

export function isPresetAmountEur(amount: number): amount is CreditPurchasePresetEur {
  return (CREDIT_PURCHASE_PRESETS_EUR as readonly number[]).includes(amount)
}
