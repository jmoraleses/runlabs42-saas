-- Permite persistir pricing desde endpoint admin autenticado sin service_role.

ALTER TABLE public.admin_model_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_model_pricing_select_authenticated ON public.admin_model_pricing;
CREATE POLICY admin_model_pricing_select_authenticated
  ON public.admin_model_pricing
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS admin_model_pricing_insert_authenticated ON public.admin_model_pricing;
CREATE POLICY admin_model_pricing_insert_authenticated
  ON public.admin_model_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS admin_model_pricing_update_authenticated ON public.admin_model_pricing;
CREATE POLICY admin_model_pricing_update_authenticated
  ON public.admin_model_pricing
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
