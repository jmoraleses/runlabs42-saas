export const DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY = 'design_cloud_orchestrator'

export type DesignCloudOrchestratorDeployStatus =
  | 'idle'
  | 'deploying'
  | 'ready'
  | 'error'

export type DesignCloudOrchestratorSetting = {
  /** Si true, la app usa Agent Engine (cuando hay engineResource). */
  enabled: boolean
  /** projects/.../reasoningEngines/ID */
  engineResource: string | null
  lastDeployAt: string | null
  deployStatus: DesignCloudOrchestratorDeployStatus
  deployMessage: string | null
}

/** Desactivado por defecto en el panel admin; el admin debe activar «Usar en la web» tras desplegar. */
export const DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING: DesignCloudOrchestratorSetting = {
  enabled: false,
  engineResource: null,
  lastDeployAt: null,
  deployStatus: 'idle',
  deployMessage: null,
}

export function parseDesignCloudOrchestratorSetting(
  value: unknown,
): DesignCloudOrchestratorSetting {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING }
  }
  const v = value as Record<string, unknown>
  const status = v.deployStatus
  const deployStatus: DesignCloudOrchestratorDeployStatus =
    status === 'deploying' ||
    status === 'ready' ||
    status === 'error' ||
    status === 'idle'
      ? status
      : 'idle'

  return {
    enabled: v.enabled === true,
    engineResource:
      typeof v.engineResource === 'string' && v.engineResource.trim()
        ? v.engineResource.trim()
        : null,
    lastDeployAt: typeof v.lastDeployAt === 'string' ? v.lastDeployAt : null,
    deployStatus,
    deployMessage: typeof v.deployMessage === 'string' ? v.deployMessage : null,
  }
}
