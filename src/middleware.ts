import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isSitePublic } from '@/lib/env'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  if (!isSitePublic()) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
    response.headers.set('X-Runlabs42-Deployment', 'staging')
  } else if (request.nextUrl.pathname.startsWith('/contact')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, webhooks, and the MCP endpoint
     * (MCP uses Bearer token auth, not session cookies).
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|icon.png|sitemap.xml|robots.txt|api/webhooks|api/mcp|visual-edit).*)',
  ],
}
