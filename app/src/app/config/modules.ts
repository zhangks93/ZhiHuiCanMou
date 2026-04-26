/**
 * Module registry - maps module IDs to UI config.
 * Actual enable/disable is driven by org_settings.enabled_module_ids.
 */

import {
  Home,
  Database,
  Calendar,
  Users,
  BarChart3,
  Target,
  Plane,
  Clock,
  Link2,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export const SECTION_LABELS: Record<string, string> = {
  workspace: '工作台',
  data: '数据',
  ai: '智能体',
  settings: '设置',
}

export const PRIMARY_NAV_CONFIG = {
  data: {
    label: '数据',
    routePath: '/data',
    icon: Database,
    sortOrder: 0,
  },
  ai: {
    label: '智能体',
    routePath: '/ai',
    icon: Sparkles,
    sortOrder: 1,
  },
  workspace: {
    label: '工作台',
    routePath: '/',
    icon: Home,
    sortOrder: 2,
  },
  settings: {
    label: '设置',
    routePath: '/settings',
    icon: Settings,
    sortOrder: 3,
  },
} as const

export interface ModuleNavConfig {
  id: string
  label: string
  routePath: string
  section: string
  icon: LucideIcon
  sortOrder: number
}

export const DATA_MODULE_IDS = [
  'biz-data',
  'opportunity',
  'trip',
  'attendance',
  'org-data',
  'planning',
] as const

export type DataModuleId = (typeof DATA_MODULE_IDS)[number]

export function isDataModuleId(value: string): value is DataModuleId {
  return (DATA_MODULE_IDS as readonly string[]).includes(value)
}

export const MODULE_NAV_CONFIG: Record<string, Omit<ModuleNavConfig, 'id'>> = {
  schedule: {
    label: '日程',
    routePath: '/schedule',
    section: 'workspace',
    icon: Calendar,
    sortOrder: 10,
  },
  links: {
    label: '系统链接',
    routePath: '/links',
    section: 'workspace',
    icon: Link2,
    sortOrder: 11,
  },
  'org-data': {
    label: '人员',
    routePath: '/org-data',
    section: 'data',
    icon: Users,
    sortOrder: 24,
  },
  planning: {
    label: '规划',
    routePath: '/planning',
    section: 'data',
    icon: Target,
    sortOrder: 25,
  },
  'biz-data': {
    label: '经营',
    routePath: '/biz-data',
    section: 'data',
    icon: BarChart3,
    sortOrder: 20,
  },
  opportunity: {
    label: '商机',
    routePath: '/opportunity',
    section: 'data',
    icon: Target,
    sortOrder: 21,
  },
  trip: {
    label: '出差',
    routePath: '/trip',
    section: 'data',
    icon: Plane,
    sortOrder: 22,
  },
  attendance: {
    label: '考勤',
    routePath: '/attendance',
    section: 'data',
    icon: Clock,
    sortOrder: 23,
  },
  ai: {
    label: 'AI 分析',
    routePath: '/ai',
    section: 'ai',
    icon: Sparkles,
    sortOrder: 30,
  },
}

/** Home and Settings are always shown, not from module registry */
export const FIXED_NAV = {
  home: {
    label: '首页',
    routePath: '/',
    section: 'workspace',
    icon: Home,
    sortOrder: 0,
  },
  settings: {
    label: '设置',
    routePath: '/settings',
    section: 'settings',
    icon: Settings,
    sortOrder: 99,
  },
}

export const DEFAULT_ENABLED_MODULE_IDS = [
  'schedule',
  'biz-data',
  'opportunity',
  'trip',
  'attendance',
  'org-data',
  'planning',
  'links',
  'ai',
]
