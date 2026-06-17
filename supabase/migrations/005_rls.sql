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
  FOR SELECT USING (auth.uid() = user_id OR public = TRUE);

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
      WHERE p.id = project_id AND (p.user_id = auth.uid() OR p.public = TRUE)
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
