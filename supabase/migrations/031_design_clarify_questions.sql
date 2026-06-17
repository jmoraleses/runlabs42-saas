-- Toggle admin para permitir preguntas de aclaración (máx. 5) en Studio.

INSERT INTO public.admin_settings (key, value, updated_at)
VALUES ('design_clarify_questions', '{"enabled": true}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
