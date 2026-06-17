-- Marketplace username (unique, case-insensitive)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
  ON public.users (LOWER(username))
  WHERE username IS NOT NULL;
