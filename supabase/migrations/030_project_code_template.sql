-- Plantilla de exportación para fase 2 (código): HTML + CMS
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS code_template TEXT NOT NULL DEFAULT 'html'
    CHECK (code_template IN (
      'html',
      'wordpress',
      'shopify',
      'woocommerce',
      'prestashop',
      'joomla'
    ));
