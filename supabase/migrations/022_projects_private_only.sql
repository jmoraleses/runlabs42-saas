-- Projects and specs are private to the owner only (no public sharing via RLS).
UPDATE public.projects SET public = FALSE WHERE public = TRUE;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "specs_select_own" ON public.specs;
CREATE POLICY "specs_select_own" ON public.specs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );
