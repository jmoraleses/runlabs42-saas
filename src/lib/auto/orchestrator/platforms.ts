export type OrchestratorPlatformId =
  | 'wordpress'
  | 'joomla'
  | 'drupal'
  | 'moodle'
  | 'prestashop'
  | 'opencart'
  | 'magento'
  | 'html'
  | 'nextjs'
  | 'nuxtjs'
  | 'sveltekit'

export type OrchestratorPlatform = {
  id: OrchestratorPlatformId
  label: string
  kind: 'cms' | 'framework' | 'ecommerce'
  stitchDesignType: 'web' | 'app'
  installStackId: string
  codeTemplate: 'html' | 'wordpress' | 'prestashop' | 'shopify' | 'joomla'
}

export const ORCHESTRATOR_PLATFORMS: OrchestratorPlatform[] = [
  {
    id: 'wordpress',
    label: 'WordPress',
    kind: 'cms',
    stitchDesignType: 'web',
    installStackId: 'wordpress',
    codeTemplate: 'wordpress',
  },
  {
    id: 'joomla',
    label: 'Joomla',
    kind: 'cms',
    stitchDesignType: 'web',
    installStackId: 'joomla',
    codeTemplate: 'joomla',
  },
  {
    id: 'drupal',
    label: 'Drupal',
    kind: 'cms',
    stitchDesignType: 'web',
    installStackId: 'drupal',
    codeTemplate: 'html',
  },
  {
    id: 'moodle',
    label: 'Moodle',
    kind: 'cms',
    stitchDesignType: 'web',
    installStackId: 'moodle',
    codeTemplate: 'html',
  },
  {
    id: 'prestashop',
    label: 'PrestaShop',
    kind: 'ecommerce',
    stitchDesignType: 'web',
    installStackId: 'prestashop',
    codeTemplate: 'prestashop',
  },
  {
    id: 'opencart',
    label: 'OpenCart',
    kind: 'ecommerce',
    stitchDesignType: 'web',
    installStackId: 'opencart',
    codeTemplate: 'html',
  },
  {
    id: 'magento',
    label: 'Magento',
    kind: 'ecommerce',
    stitchDesignType: 'web',
    installStackId: 'magento',
    codeTemplate: 'html',
  },
  {
    id: 'html',
    label: 'HTML',
    kind: 'framework',
    stitchDesignType: 'web',
    installStackId: 'html',
    codeTemplate: 'html',
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    kind: 'framework',
    stitchDesignType: 'web',
    installStackId: 'nextjs',
    codeTemplate: 'html',
  },
  {
    id: 'nuxtjs',
    label: 'Nuxt.js',
    kind: 'framework',
    stitchDesignType: 'web',
    installStackId: 'nuxtjs',
    codeTemplate: 'html',
  },
  {
    id: 'sveltekit',
    label: 'SvelteKit',
    kind: 'framework',
    stitchDesignType: 'web',
    installStackId: 'sveltekit',
    codeTemplate: 'html',
  },
]

export function getOrchestratorPlatform(id: string): OrchestratorPlatform | null {
  return ORCHESTRATOR_PLATFORMS.find((p) => p.id === id) ?? null
}
