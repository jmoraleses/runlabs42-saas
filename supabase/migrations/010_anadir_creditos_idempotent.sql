-- Idempotencia: no duplicar créditos si el webhook de Stripe se repite
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
