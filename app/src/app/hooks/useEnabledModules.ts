import { useEffect, useMemo, useState } from 'react'
import {
  MODULE_NAV_CONFIG,
  PRIMARY_NAV_CONFIG,
  FIXED_NAV,
} from '@/app/config/modules'
import { getEnabledModules, subscribeEnabledModules } from '@/shared/lib/moduleStorage'

export interface NavItem {
  to: string
  icon: import('lucide-react').LucideIcon
  label: string
  badge?: string | number
  moduleId?: string
}

export interface NavSection {
  key: string
  title: string
  items: NavItem[]
}

export function useEnabledModules() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>(() => getEnabledModules())

  useEffect(() => {
    return subscribeEnabledModules(setEnabledModuleIds)
  }, [])

  const navSections = useMemo(() => buildNavSections(enabledModuleIds), [enabledModuleIds])
  const topLevelNav = useMemo(() => buildTopLevelNav(navSections), [navSections])

  return {
    navSections,
    topLevelNav,
    enabledModuleIds,
    isLoading: false,
  }
}

function buildNavSections(enabledModuleIds: string[]): NavSection[] {
  const workspace: NavItem[] = [
    { to: FIXED_NAV.home.routePath, icon: FIXED_NAV.home.icon, label: FIXED_NAV.home.label },
  ]
  const data: NavItem[] = []
  const ai: NavItem[] = []
  const settings: NavItem[] = []

  for (const id of enabledModuleIds) {
    const config = MODULE_NAV_CONFIG[id]
    if (!config) continue

    const item: NavItem = {
      to: config.routePath,
      icon: config.icon,
      label: config.label,
      moduleId: id,
    }

    if (config.section === 'workspace') workspace.push(item)
    else if (config.section === 'data') data.push(item)
    else if (config.section === 'ai') ai.push(item)
  }

  data.sort((a, b) => {
    const leftOrder = a.moduleId ? MODULE_NAV_CONFIG[a.moduleId]?.sortOrder ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    const rightOrder = b.moduleId ? MODULE_NAV_CONFIG[b.moduleId]?.sortOrder ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  settings.push({
    to: FIXED_NAV.settings.routePath,
    icon: FIXED_NAV.settings.icon,
    label: FIXED_NAV.settings.label,
  })

  const sections: NavSection[] = []
  if (data.length > 0) {
    sections.push({ key: 'data', title: '数据', items: data })
  }
  if (ai.length > 0) {
    sections.push({ key: 'ai', title: '智能体', items: ai })
  }
  if (workspace.length > 0) {
    sections.push({ key: 'workspace', title: '工作台', items: workspace })
  }
  if (settings.length > 0) {
    sections.push({ key: 'settings', title: '设置', items: settings })
  }

  return sections
}

function buildTopLevelNav(sections: NavSection[]): NavItem[] {
  const items: NavItem[] = []

  for (const section of sections) {
    const config = PRIMARY_NAV_CONFIG[section.key as keyof typeof PRIMARY_NAV_CONFIG]
    if (!config) continue

    items.push({
      to: config.routePath,
      icon: config.icon,
      label: config.label,
    })
  }

  return items
}
