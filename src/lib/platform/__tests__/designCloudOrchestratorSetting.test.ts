import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING,
  parseDesignCloudOrchestratorSetting,
} from '@/lib/platform/designCloudOrchestratorSetting'

describe('parseDesignCloudOrchestratorSetting', () => {
  it('defaults to disabled when value missing', () => {
    expect(DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING.enabled).toBe(false)
    expect(parseDesignCloudOrchestratorSetting(undefined).enabled).toBe(false)
    expect(parseDesignCloudOrchestratorSetting(null).enabled).toBe(false)
  })

  it('requires enabled: true explicitly', () => {
    expect(parseDesignCloudOrchestratorSetting({ enabled: true }).enabled).toBe(true)
    expect(parseDesignCloudOrchestratorSetting({ enabled: false }).enabled).toBe(false)
    expect(parseDesignCloudOrchestratorSetting({ engineResource: 'projects/p/locations/us/reasoningEngines/1' }).enabled).toBe(
      false,
    )
  })
})
