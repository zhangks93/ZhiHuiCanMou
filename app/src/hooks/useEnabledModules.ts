import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MODULE_NAV_CONFIG,
  SECTION_LABELS,
  FIXED_NAV,
  DEFAULT_ENABLED_MODULE_IDS,
} from '@/config/modules'

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
  const { navSections, isLoading } = useOrgModuleSettings()

  const enabledModuleIds = useMemo(() => {
    if (!navSections) return DEFAULT_ENABLED_MODULE_IDS
    const ids = new Set<string>()
    navSections.forEach((s) =>
      s.items.forEach((i) => {
        if (i.moduleId) ids.add(i.moduleId)
      })
    )
    return Array.from(ids)
  }, [navSections])

  return {
    navSections: navSections ?? buildNavSections(DEFAULT_ENABLED_MODULE_IDS),
    enabledModuleIds,
    isLoading,
  }
}

/** Fetches org_settings and builds nav sections. */
function useOrgModuleSettings(): {
  navSections: NavSection[] | null
  isLoading: boolean
} {
  const [state, setState] = useState<{
    navSections: NavSection[] | null
    isLoading: boolean
  }>({ navSections: null, isLoading: true })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setState({ navSections: buildNavSections(DEFAULT_ENABLED_MODULE_IDS), isLoading: false })
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single()

        const orgId = profile?.org_id ?? '00000000-0000-0000-0000-000000000001'

        const { data: settings } = await supabase
          .from('org_settings')
          .select('enabled_module_ids')
          .eq('org_id', orgId)
          .single()

        const enabledIds =
          (settings?.enabled_module_ids as string[] | null) ?? DEFAULT_ENABLED_MODULE_IDS

        if (!cancelled) {
          setState({ navSections: buildNavSections(enabledIds), isLoading: false })
        }
      } catch (e) {
        console.warn('[Canmou] Failed to load org settings:', e)
        if (!cancelled) {
          setState({ navSections: buildNavSections(DEFAULT_ENABLED_MODULE_IDS), isLoading: false })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
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
      badge: id === 'schedule' ? 3 : id === 'biz-data' ? '!' : undefined,
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
