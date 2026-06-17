import type { MobileConfig } from '@/types/mobile'

export function slugifyAppId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return slug || 'runlabsapp'
}

export function defaultMobileConfig(projectName: string): MobileConfig {
  const slug = slugifyAppId(projectName)
  const appId = `com.runlabs.${slug}`
  return {
    appId,
    displayName: projectName.slice(0, 40) || 'Runlabs App',
    iosBundleId: appId,
    androidPackage: appId,
  }
}
