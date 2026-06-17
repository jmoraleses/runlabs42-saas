-- Renombra auto_brief_items -> auto_topic_items (columna brief -> topic).
-- En entornos donde la 033 no se aplicó, crea la tabla con el nombre nuevo.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'auto_brief_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.auto_brief_items RENAME TO auto_topic_items';
    EXECUTE 'ALTER TABLE public.auto_topic_items RENAME COLUMN brief TO topic';
    EXECUTE 'ALTER INDEX IF EXISTS public.auto_brief_items_user_brief_idx RENAME TO auto_topic_items_user_topic_idx';
    EXECUTE 'ALTER INDEX IF EXISTS public.auto_brief_items_user_status_idx RENAME TO auto_topic_items_user_status_idx';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_auto_brief_items_updated_at ON public.auto_topic_items';
    EXECUTE 'DROP FUNCTION IF EXISTS public.touch_auto_brief_items_updated_at()';
    EXECUTE 'DROP POLICY IF EXISTS "auto_brief_items_select_own" ON public.auto_topic_items';
    EXECUTE 'DROP POLICY IF EXISTS "auto_brief_items_insert_own" ON public.auto_topic_items';
    EXECUTE 'DROP POLICY IF EXISTS "auto_brief_items_update_own" ON public.auto_topic_items';
    EXECUTE 'DROP POLICY IF EXISTS "auto_brief_items_delete_own" ON public.auto_topic_items';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.auto_topic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS auto_topic_items_user_topic_idx
  ON public.auto_topic_items(user_id, topic);
CREATE INDEX IF NOT EXISTS auto_topic_items_user_status_idx
  ON public.auto_topic_items(user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_auto_topic_items_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_auto_topic_items_updated_at ON public.auto_topic_items;
CREATE TRIGGER trg_touch_auto_topic_items_updated_at
BEFORE UPDATE ON public.auto_topic_items
FOR EACH ROW EXECUTE FUNCTION public.touch_auto_topic_items_updated_at();

ALTER TABLE public.auto_topic_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_topic_items_select_own" ON public.auto_topic_items;
DROP POLICY IF EXISTS "auto_topic_items_insert_own" ON public.auto_topic_items;
DROP POLICY IF EXISTS "auto_topic_items_update_own" ON public.auto_topic_items;
DROP POLICY IF EXISTS "auto_topic_items_delete_own" ON public.auto_topic_items;

CREATE POLICY "auto_topic_items_select_own" ON public.auto_topic_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "auto_topic_items_insert_own" ON public.auto_topic_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auto_topic_items_update_own" ON public.auto_topic_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "auto_topic_items_delete_own" ON public.auto_topic_items
  FOR DELETE USING (auth.uid() = user_id);

UPDATE public.admin_settings
   SET key = 'auto_topic_llm_model'
 WHERE key = 'auto_brief_llm_model';
