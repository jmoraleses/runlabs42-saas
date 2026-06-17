-- Mapeo configurable por proyecto para query params de enlaces en templates CMS.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS code_template_link_param_map JSONB;
