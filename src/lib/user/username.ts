export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30

const USERNAME_PATTERN = /^[a-z0-9_]+$/

/** Normaliza entrada: quita @, minúsculas, recorta espacios. */
export function normalizeUsername(raw: string): string {
  let value = raw.trim().toLowerCase()
  if (value.startsWith('@')) value = value.slice(1)
  return value
}

export function isValidUsernameFormat(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  )
}

export function formatUsernameDisplay(username: string | null | undefined): string {
  if (!username) return ''
  return `@${username}`
}
