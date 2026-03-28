import { useEffect, useMemo, useState } from 'react'
import {
  MODULE_NAV_CONFIG,
  SECTION_LABELS,
  FIXED_NAV,
} from '@/config/modules'
import { getEnabledModules, subscribeEnabledModules } from '@/lib/moduleStorage'

export interface NavItem {
  to: string
  icon: import('lucide-react').LucideIcon
  label: string
  badge?: string | number
  moduleId?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export function useEnabledModules() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>(() => getEnabledModules())

  useEffect(() => {
    return subscribeEnabledModules(setEnabledModuleIds)
  }, [])

  const navSections = useMemo(() => buildNavSections(enabledModuleIds), [enabledModuleIds])

  return {
    navSections,
    enabledModuleIds,
    isLoading: false,
  }
}

function buildNavSections(enabledModuleIds: string[]): NavSection[] {
  const workbench: NavItem[] = [
    { to: FIXED_NAV.home.routePath, icon: FIXED_NAV.home.icon, label: FIXED_NAV.home.label },
  ]
  const dataCenter: NavItem[] = []
  const business: NavItem[] = []
  const tools: NavItem[] = []

  for (const id of enabledModuleIds) {
    const config = MODULE_NAV_CONFIG[id]
    if (!config) continue

    const item: NavItem = {
      to: config.routePath,
      icon: config.icon,
      label: config.label,
      moduleId: id,
    }

    if (config.section === 'workbench') workbench.push(item)
    else if (config.section === 'data-center') dataCenter.push(item)
    else if (config.section === 'business') business.push(item)
    else if (config.section === 'tools') tools.push(item)
  }

  tools.push({
    to: FIXED_NAV.settings.routePath,
    icon: FIXED_NAV.settings.icon,
    label: FIXED_NAV.settings.label,
  })

  const sections: NavSection[] = []
  if (workbench.length > 0) {
    sections.push({ title: SECTION_LABELS.workbench ?? '工作台', items: workbench })
  }
  if (dataCenter.length > 0) {
    sections.push({ title: SECTION_LABELS['data-center'] ?? '数据中心', items: dataCenter })
  }
  if (business.length > 0) {
    sections.push({ title: SECTION_LABELS.business ?? '业务管理', items: business })
  }
  if (tools.length > 0) {
    sections.push({ title: SECTION_LABELS.tools ?? '工具与分析', items: tools })
  }

  return sections
}
