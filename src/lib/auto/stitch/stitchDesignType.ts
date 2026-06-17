export type StitchDesignType = 'web' | 'app'

export function parseStitchDesignType(value: unknown): StitchDesignType {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'app' || raw === 'mobile' || raw === 'aplicación' || raw === 'aplicacion') {
    return 'app'
  }
  return 'web'
}
