const MEMORY_EXTRACT_OPT_OUT_KEY = 'studio_memory_extract_opt_out'

export function isMemoryExtractEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(MEMORY_EXTRACT_OPT_OUT_KEY) !== '1'
  } catch {
    return true
  }
}

export function setMemoryExtractEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (enabled) {
      window.localStorage.removeItem(MEMORY_EXTRACT_OPT_OUT_KEY)
    } else {
      window.localStorage.setItem(MEMORY_EXTRACT_OPT_OUT_KEY, '1')
    }
  } catch {
    /* ignore */
  }
}
