import type { DesignSiteType } from '@/lib/design/designBrief'

const BASE_CONTACT = `
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  form_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const ECOMMERCE = `
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const BLOG = `
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW()
);
`

const SAAS = `
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

export function sqlSchemaForSiteType(siteType: DesignSiteType): string {
  switch (siteType) {
    case 'ecommerce':
      return `${BASE_CONTACT}\n${ECOMMERCE}`
    case 'blog':
      return `${BASE_CONTACT}\n${BLOG}`
    case 'saas':
      return `${BASE_CONTACT}\n${SAAS}`
    case 'dashboard':
    case 'portfolio':
    case 'landing':
    default:
      return BASE_CONTACT
  }
}
