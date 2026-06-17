export const PROTECTED_PREFIXES = ['/studio', '/projects', '/settings', '/onboarding'] as const

export const AUTH_PREFIXES = ['/auth/signin', '/auth/signup'] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
