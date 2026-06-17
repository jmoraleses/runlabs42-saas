import type { MetadataRoute } from 'next'
import { getAppUrl, isSitePublic } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isSitePublic()) return []

  const base = getAppUrl()
  const routes = [
    '',
    '/pricing',
    '/about',
    '/auth/signin',
    '/auth/signup',
    '/marketplace',
    '/legal/privacy',
    '/legal/cookies',
    '/legal/terms',
  ]
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
