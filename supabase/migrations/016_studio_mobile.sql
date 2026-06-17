-- Studio mobile export: config, readiness, build jobs

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS target_platforms TEXT[] DEFAULT ARRAY['web']::TEXT[],
  ADD COLUMN IF NOT EXISTS mobile_config JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS mobile_readiness JSONB,
  ADD COLUMN IF NOT EXISTS last_mobile_build_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS mobile_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  checks JSONB NOT NULL DEFAULT '[]'::JSONB,
  targets TEXT[] NOT NULL DEFAULT ARRAY['ios', 'android']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_scans_project ON mobile_scans(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL DEFAULT 'remote',
  artifact_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_builds_project ON mobile_builds(project_id, created_at DESC);
