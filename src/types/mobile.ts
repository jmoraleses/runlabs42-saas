export type TargetPlatform = 'web' | 'ios' | 'android'

export type MobileConfig = {
  appId: string
  displayName: string
  iconUrl?: string
  splashUrl?: string
  iosBundleId?: string
  androidPackage?: string
}

export type MobileCheckStatus = 'pass' | 'partial' | 'fail'

export type MobileCheck = {
  id: string
  label: string
  status: MobileCheckStatus
  message: string
  severity: 'critical' | 'warning' | 'info'
}

export type MobileReadiness = {
  score: number
  checks: MobileCheck[]
  scannedAt: string
  targets?: TargetPlatform[]
}

export type MobileBuildStatus = 'pending' | 'running' | 'completed' | 'failed'

export type MobileBuildMode = 'remote' | 'bundled'
