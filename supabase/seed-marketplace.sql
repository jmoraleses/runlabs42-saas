-- Optional demo listings (run once in SQL Editor after migrations + at least one user exists)
-- Replace CREATOR_ID with your auth.users id if the subquery returns null.

INSERT INTO public.marketplace_products (
  creator_id,
  name,
  description,
  category,
  framework,
  github_repo,
  price_credits,
  rating,
  downloads,
  published_at
)
SELECT
  u.id,
  'Auth Starter Kit',
  'OAuth-ready auth flows for React and Next.js apps.',
  'auth,starter',
  'react',
  'https://github.com/vercel/next.js',
  0,
  4.8,
  3892,
  NOW()
FROM public.users u
LIMIT 1
ON CONFLICT DO NOTHING;
