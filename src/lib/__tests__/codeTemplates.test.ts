import { describe, expect, it } from 'vitest'
import {
  CODE_TEMPLATES,
  DEFAULT_CODE_TEMPLATE,
  isValidCodeTemplate,
  normalizeCodeTemplate,
} from '@/lib/codeTemplates'

describe('codeTemplates', () => {
  it('lists six templates', () => {
    expect(CODE_TEMPLATES).toHaveLength(6)
    expect(CODE_TEMPLATES).toContain('html')
    expect(CODE_TEMPLATES).toContain('joomla')
  })

  it('normalizes invalid values to html', () => {
    expect(normalizeCodeTemplate(undefined)).toBe(DEFAULT_CODE_TEMPLATE)
    expect(normalizeCodeTemplate('react')).toBe('html')
    expect(normalizeCodeTemplate('shopify')).toBe('shopify')
  })

  it('validates known ids', () => {
    expect(isValidCodeTemplate('woocommerce')).toBe(true)
    expect(isValidCodeTemplate('drupal')).toBe(false)
  })
})
