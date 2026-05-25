import { describe, expect, it } from 'vitest'
import { DATA_MODULE_REGISTRY, WORKSPACE_TAB_REGISTRY } from '@/app/config/moduleRegistry'
import { DATA_MODULE_IDS } from '@/app/config/modules'
import { WORKSPACE_TAB_LABELS } from '@/features/workspace/workspaceTabs'

describe('moduleRegistry', () => {
  it('registers every data module id', () => {
    for (const moduleId of DATA_MODULE_IDS) {
      expect(DATA_MODULE_REGISTRY[moduleId]?.component).toBeDefined()
    }
  })

  it('registers every workspace tab', () => {
    for (const tab of Object.keys(WORKSPACE_TAB_LABELS)) {
      expect(WORKSPACE_TAB_REGISTRY[tab as keyof typeof WORKSPACE_TAB_REGISTRY]?.component).toBeDefined()
    }
  })
})
