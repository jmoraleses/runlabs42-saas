-- Spec-Kit: marketplace (P2P listings + purchases)
CREATE TABLE IF NOT EXISTS public.marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  framework TEXT,
  github_repo TEXT,
  price_credits INTEGER NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  preview_url TEXT,
  rating FLOAT NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS marketplace_products_creator_idx ON public.marketplace_products (creator_id);
CREATE INDEX IF NOT EXISTS marketplace_purchases_user_idx ON public.marketplace_purchases (user_id);
