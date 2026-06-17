const STORAGE_KEY = 'runlabs42.pendingGithubImport'

export function setPendingGithubImport() {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, '1')
}

export function hasPendingGithubImport(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

export function clearPendingGithubImport() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function consumePendingGithubImport(): boolean {
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(STORAGE_KEY) !== '1') return false
  sessionStorage.removeItem(STORAGE_KEY)
  return true
}
