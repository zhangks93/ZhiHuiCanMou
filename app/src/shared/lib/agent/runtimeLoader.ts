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
      import('./tools/resolveOrgNodes'),
      import('./tools/readFile'),
      import('./tools/auditBusinessReport'),
      import('./tools/composeBusinessReport'),
      import('./tools/memoryTools'),
    ]).then(([
      chatAgentModule,
      queryBizDataModule,
      queryWithHierarchyModule,
      queryBusinessReportPackModule,
      resolveOrgNodesModule,
      readFileModule,
      auditBusinessReportModule,
      composeBusinessReportModule,
      memoryToolsModule,
    ]) => ({
      ChatAgent: chatAgentModule.ChatAgent,
      tools: [
        resolveOrgNodesModule.resolveOrgNodesTool,
        queryWithHierarchyModule.queryWithHierarchyTool,
        queryBusinessReportPackModule.queryBusinessReportPackTool,
        composeBusinessReportModule.composeBusinessReportTool,
        queryBizDataModule.queryBizDataTool,
        auditBusinessReportModule.auditBusinessReportTool,
        readFileModule.readFileTool,
        ...memoryToolsModule.memoryTools,
      ],
    }))
  }

  return runtimeModulesPromise
}
