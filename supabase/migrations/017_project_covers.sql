-- Portadas de proyecto: primera imagen = cover_url (tarjetas), array completo en detalle
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_images JSONB;

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS cover_images JSONB;
