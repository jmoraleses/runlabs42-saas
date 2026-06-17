import { describe, expect, it } from 'vitest'
import { getCmsScaffold } from '@/lib/scaffolds/cms'

describe('cms scaffold marketplace compatibility', () => {
  it('includes WooCommerce support declaration', () => {
    const files = getCmsScaffold('woocommerce', 'Demo Shop')
    const functionsPhp = files.find((f) => f.path === 'export/wordpress/functions.php')?.content ?? ''
    expect(functionsPhp).toContain("add_theme_support('woocommerce')")
  })

  it('includes required PrestaShop validation files', () => {
    const files = getCmsScaffold('prestashop', 'Demo Shop')
    const paths = new Set(files.map((f) => f.path))
    const slug = 'demo-shop'
    expect(paths.has(`export/prestashop/themes/${slug}/config/theme.yml`)).toBe(true)
    expect(paths.has(`export/prestashop/themes/${slug}/assets/js/theme.js`)).toBe(true)
    expect(paths.has(`export/prestashop/themes/${slug}/preview.png`)).toBe(true)
    expect(paths.has(`export/prestashop/themes/${slug}/templates/checkout/checkout.tpl`)).toBe(true)
    expect(paths.has(`export/prestashop/themes/${slug}/templates/customer/my-account.tpl`)).toBe(true)
  })

  it('includes marketplace package docs for TemplateMonster and ThemeForest', () => {
    const files = getCmsScaffold('shopify', 'Demo Shop')
    const paths = new Set(files.map((f) => f.path))
    expect(paths.has('marketplace/templatemonster/Documentation/index.html')).toBe(true)
    expect(paths.has('marketplace/templatemonster/Demo Content/README.txt')).toBe(true)
    expect(paths.has('marketplace/themeforest/documentation/index.html')).toBe(true)
    expect(paths.has('marketplace/themeforest/changelog.txt')).toBe(true)
  })
})
