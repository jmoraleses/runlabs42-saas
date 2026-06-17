-- Repo GitHub vinculado solo tras publicación explícita
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS github_repo TEXT;

CREATE INDEX IF NOT EXISTS projects_github_repo_idx ON public.projects (github_repo)
  WHERE github_repo IS NOT NULL;
