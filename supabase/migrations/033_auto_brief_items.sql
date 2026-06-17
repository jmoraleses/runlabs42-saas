CREATE TABLE IF NOT EXISTS public.auto_brief_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brief TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS auto_brief_items_user_brief_idx
  ON public.auto_brief_items(user_id, brief);

CREATE INDEX IF NOT EXISTS auto_brief_items_user_status_idx
  ON public.auto_brief_items(user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_auto_brief_items_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_auto_brief_items_updated_at ON public.auto_brief_items;
CREATE TRIGGER trg_touch_auto_brief_items_updated_at
BEFORE UPDATE ON public.auto_brief_items
FOR EACH ROW EXECUTE FUNCTION public.touch_auto_brief_items_updated_at();

ALTER TABLE public.auto_brief_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_brief_items_select_own" ON public.auto_brief_items;
CREATE POLICY "auto_brief_items_select_own" ON public.auto_brief_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_brief_items_insert_own" ON public.auto_brief_items;
CREATE POLICY "auto_brief_items_insert_own" ON public.auto_brief_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_brief_items_update_own" ON public.auto_brief_items;
CREATE POLICY "auto_brief_items_update_own" ON public.auto_brief_items
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_brief_items_delete_own" ON public.auto_brief_items;
CREATE POLICY "auto_brief_items_delete_own" ON public.auto_brief_items
  FOR DELETE USING (auth.uid() = user_id);
