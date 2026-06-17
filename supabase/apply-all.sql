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
-- Spec-Kit: credit audit log (immutable)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'refund')),
  description TEXT,
  model TEXT,
  tokens_used INTEGER,
  stripe_charge_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON public.transactions (created_at DESC);
-- Spec-Kit: projects and versioned specs
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  framework TEXT NOT NULL DEFAULT 'next',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft', 'shipped', 'deleted')),
  public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON public.projects (updated_at DESC);
CREATE INDEX IF NOT EXISTS specs_project_id_idx ON public.specs (project_id);
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
-- Spec-Kit: Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND credits = (SELECT u.credits FROM public.users u WHERE u.id = auth.uid()));

-- transactions (read-only for users)
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- specs (via project ownership)
DROP POLICY IF EXISTS "specs_select_own" ON public.specs;
CREATE POLICY "specs_select_own" ON public.specs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "specs_insert_own" ON public.specs;
CREATE POLICY "specs_insert_own" ON public.specs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "specs_update_own" ON public.specs;
CREATE POLICY "specs_update_own" ON public.specs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "specs_delete_own" ON public.specs;
CREATE POLICY "specs_delete_own" ON public.specs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- marketplace
DROP POLICY IF EXISTS "products_select_all" ON public.marketplace_products;
CREATE POLICY "products_select_all" ON public.marketplace_products
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "products_insert_own" ON public.marketplace_products;
CREATE POLICY "products_insert_own" ON public.marketplace_products
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "products_update_own" ON public.marketplace_products;
CREATE POLICY "products_update_own" ON public.marketplace_products
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "purchases_select_own" ON public.marketplace_purchases;
CREATE POLICY "purchases_select_own" ON public.marketplace_purchases
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchases_insert_own" ON public.marketplace_purchases;
CREATE POLICY "purchases_insert_own" ON public.marketplace_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Spec-Kit: atomic credit operations (service_role / SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.deducir_creditos(
  p_user_id UUID,
  p_amount INTEGER,
  p_model TEXT DEFAULT NULL,
  p_tokens INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT credits INTO v_credits
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET credits = credits - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, model, tokens_used, description)
  VALUES (p_user_id, p_amount, 'debit', p_model, p_tokens, p_description);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.anadir_creditos(
  p_user_id UUID,
  p_amount INTEGER,
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  IF p_stripe_charge_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE stripe_charge_id = p_stripe_charge_id
      AND type = 'credit'
  ) THEN
    RETURN TRUE;
  END IF;

  UPDATE public.users
  SET credits = credits + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, stripe_charge_id, description)
  VALUES (p_user_id, p_amount, 'credit', p_stripe_charge_id, p_description);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deducir_creditos TO service_role;
GRANT EXECUTE ON FUNCTION public.anadir_creditos TO service_role;

-- Runlabs42: project source files
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS project_files_project_id_idx ON public.project_files (project_id);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_files_select_own" ON public.project_files;
CREATE POLICY "project_files_select_own" ON public.project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_insert_own" ON public.project_files;
CREATE POLICY "project_files_insert_own" ON public.project_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_update_own" ON public.project_files;
CREATE POLICY "project_files_update_own" ON public.project_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_delete_own" ON public.project_files;
CREATE POLICY "project_files_delete_own" ON public.project_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- Runlabs42: API keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys (user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select_own" ON public.api_keys;
CREATE POLICY "api_keys_select_own" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "api_keys_insert_own" ON public.api_keys;
CREATE POLICY "api_keys_insert_own" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "api_keys_delete_own" ON public.api_keys;
CREATE POLICY "api_keys_delete_own" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Spec-Kit: auto-create profile on signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, credits)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    25
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at fresh on profile edits
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 011: integraciones Vercel + Supabase por usuario
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  supabase_project_ref TEXT,
  supabase_url TEXT,
  supabase_anon_key_enc TEXT,
  supabase_service_role_enc TEXT,
  supabase_connected_at TIMESTAMPTZ,
  vercel_team_id TEXT,
  vercel_access_token_enc TEXT,
  vercel_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_integrations_select_own" ON public.user_integrations;
CREATE POLICY "user_integrations_select_own" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_insert_own" ON public.user_integrations;
CREATE POLICY "user_integrations_insert_own" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_update_own" ON public.user_integrations;
CREATE POLICY "user_integrations_update_own" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_delete_own" ON public.user_integrations;
CREATE POLICY "user_integrations_delete_own" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'user_supabase'
    CHECK (storage_provider IN ('platform', 'user_supabase')),
  ADD COLUMN IF NOT EXISTS external_supabase_ref TEXT,
  ADD COLUMN IF NOT EXISTS external_vercel_project_id TEXT,
  ADD COLUMN IF NOT EXISTS deployed_url TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_listed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS projects_marketplace_listed_idx ON public.projects (marketplace_listed)
  WHERE marketplace_listed = TRUE;

DROP TRIGGER IF EXISTS user_integrations_set_updated_at ON public.user_integrations;
CREATE TRIGGER user_integrations_set_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 016_studio_mobile.sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS target_platforms TEXT[] DEFAULT ARRAY['web']::TEXT[],
  ADD COLUMN IF NOT EXISTS mobile_config JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS mobile_readiness JSONB,
  ADD COLUMN IF NOT EXISTS last_mobile_build_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.mobile_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  checks JSONB NOT NULL DEFAULT '[]'::JSONB,
  targets TEXT[] NOT NULL DEFAULT ARRAY['ios', 'android']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_scans_project ON public.mobile_scans(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mobile_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL DEFAULT 'remote',
  artifact_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_builds_project ON public.mobile_builds(project_id, created_at DESC);

-- ========== 018: chat + memoria semántica ==========

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_project_id_idx ON public.chat_sessions (project_id);
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  storage_key TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  workspace_snapshot_id TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages (session_id, sort_order);

CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_memories_user_id_idx ON public.user_memories (user_id);

CREATE TABLE IF NOT EXISTS public.project_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_memories_project_id_idx ON public.project_memories (project_id);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions_select_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_select_own" ON public.chat_sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_sessions_insert_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_insert_own" ON public.chat_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid() AND p.status <> 'deleted'
    )
  );

DROP POLICY IF EXISTS "chat_sessions_update_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_update_own" ON public.chat_sessions
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_sessions_delete_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_delete_own" ON public.chat_sessions
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_update_own" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own" ON public.chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own" ON public.chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_memories_select_own" ON public.user_memories;
CREATE POLICY "user_memories_select_own" ON public.user_memories
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_memories_insert_own" ON public.user_memories;
CREATE POLICY "user_memories_insert_own" ON public.user_memories
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_memories_update_own" ON public.user_memories;
CREATE POLICY "user_memories_update_own" ON public.user_memories
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_memories_delete_own" ON public.user_memories;
CREATE POLICY "user_memories_delete_own" ON public.user_memories
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "project_memories_select_own" ON public.project_memories;
CREATE POLICY "project_memories_select_own" ON public.project_memories
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "project_memories_insert_own" ON public.project_memories;
CREATE POLICY "project_memories_insert_own" ON public.project_memories
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_memories_update_own" ON public.project_memories;
CREATE POLICY "project_memories_update_own" ON public.project_memories
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "project_memories_delete_own" ON public.project_memories;
CREATE POLICY "project_memories_delete_own" ON public.project_memories
  FOR DELETE USING (user_id = auth.uid());
