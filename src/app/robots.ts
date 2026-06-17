import type { MetadataRoute } from 'next'
import { getAppUrl, isSitePublic } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl()

  if (!isSitePublic()) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/settings', '/contact', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
