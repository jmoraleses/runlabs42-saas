-- Spec-Kit: user profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'team')),
  credits INTEGER NOT NULL DEFAULT 25,
  credits_renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id TEXT UNIQUE,
  settings JSONB NOT NULL DEFAULT '{"theme":"dark","language":"en","notifications":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_plan_idx ON public.users (plan);
