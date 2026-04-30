export const WORKSPACE_TAB_LABELS = {
  schedule: '日程',
  inbox: '收件箱',
  links: '链接',
} as const

export type WorkspaceTab = keyof typeof WORKSPACE_TAB_LABELS

export function getWorkspaceTabs(enabledModuleIds: string[]): WorkspaceTab[] {
  const availableTabs: WorkspaceTab[] = []

  if (enabledModuleIds.includes('schedule')) {
    availableTabs.push('schedule', 'inbox')
  }
  if (enabledModuleIds.includes('links')) {
    availableTabs.push('links')
  }

  return availableTabs
}
