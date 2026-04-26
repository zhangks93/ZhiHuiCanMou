import type { ChatAgent } from './chatAgent'
import type { RegisteredTool } from './types'

interface AgentRuntimeModules {
  ChatAgent: typeof ChatAgent
  tools: RegisteredTool[]
}

let runtimeModulesPromise: Promise<AgentRuntimeModules> | null = null

export function loadAgentRuntimeModules(): Promise<AgentRuntimeModules> {
  if (!runtimeModulesPromise) {
    runtimeModulesPromise = Promise.all([
      import('./chatAgent'),
      import('./tools/queryBizData'),
      import('./tools/queryWithHierarchy'),
      import('./tools/queryBusinessReportPack'),
      import('./tools/queryMonthlyPlan'),
      import('./tools/resolveOrgNodes'),
      import('./tools/readFile'),
    ]).then(([
      chatAgentModule,
      queryBizDataModule,
      queryWithHierarchyModule,
      queryBusinessReportPackModule,
      queryMonthlyPlanModule,
      resolveOrgNodesModule,
      readFileModule,
    ]) => ({
      ChatAgent: chatAgentModule.ChatAgent,
      tools: [
        resolveOrgNodesModule.resolveOrgNodesTool,
        queryWithHierarchyModule.queryWithHierarchyTool,
        queryBusinessReportPackModule.queryBusinessReportPackTool,
        queryMonthlyPlanModule.queryMonthlyPlanTool,
        queryBizDataModule.queryBizDataTool,
        readFileModule.readFileTool,
      ],
    }))
  }

  return runtimeModulesPromise
}
