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
