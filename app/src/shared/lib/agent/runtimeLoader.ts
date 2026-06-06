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
      import('./tools/resolveOrgNodes'),
      import('./tools/readFile'),
      import('./tools/memoryTools'),
      import('./tools/feishuTools'),
    ]).then(([
      chatAgentModule,
      queryBizDataModule,
      queryWithHierarchyModule,
      resolveOrgNodesModule,
      readFileModule,
      memoryToolsModule,
      feishuToolsModule,
    ]) => ({
      ChatAgent: chatAgentModule.ChatAgent,
      tools: [
        resolveOrgNodesModule.resolveOrgNodesTool,
        queryWithHierarchyModule.queryWithHierarchyTool,
        queryBizDataModule.queryBizDataTool,
        readFileModule.readFileTool,
        ...memoryToolsModule.memoryTools,
        ...feishuToolsModule.feishuTools,
      ],
    }))
  }

  return runtimeModulesPromise
}
