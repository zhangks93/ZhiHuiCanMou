/**
 * Module registry - maps module IDs to UI config.
 * Actual enable/disable is driven by org_settings.enabled_module_ids.
 */

import {
  Home,
  Calendar,
  Users,
  BarChart3,
  Target,
  Trophy,
  Plane,
  Clock,
  Link2,
  Sparkles,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react'

export const SECTION_LABELS: Record<string, string> = {
  workbench: '工作台',
  'data-center': '数据中心',
  business: '业务管理',
  tools: '工具与分析',
}

export interface ModuleNavConfig {
  id: string
  label: string
  routePath: string
  section: string
  icon: LucideIcon
  sortOrder: number
}

export const MODULE_NAV_CONFIG: Record<string, Omit<ModuleNavConfig, 'id'>> = {
  'work-report': {
    label: '项目协同',
    routePath: '/work-report',
    section: 'workbench',
    icon: FileText,
    sortOrder: 5,
  },
  schedule: {
    label: '日程提醒',
    routePath: '/schedule',
    section: 'workbench',
    icon: Calendar,
    sortOrder: 10,
  },
  'org-data': {
    label: '常用数据',
    routePath: '/org-data',
    section: 'data-center',
    icon: Users,
    sortOrder: 20,
  },
  'biz-data': {
    label: '经营数据',
    routePath: '/biz-data',
    section: 'data-center',
    icon: BarChart3,
    sortOrder: 21,
  },
  opportunity: {
    label: '商机台账',
    routePath: '/opportunity',
    section: 'business',
    icon: Target,
    sortOrder: 30,
  },
  competitor: {
    label: '竞对档案',
    routePath: '/competitor',
    section: 'business',
    icon: Trophy,
    sortOrder: 31,
  },
  trip: {
    label: '出差管理',
    routePath: '/trip',
    section: 'business',
    icon: Plane,
    sortOrder: 32,
  },
  attendance: {
    label: '考勤管理',
    routePath: '/attendance',
    section: 'business',
    icon: Clock,
    sortOrder: 33,
  },
  links: {
    label: '系统链接',
    routePath: '/links',
    section: 'tools',
    icon: Link2,
    sortOrder: 40,
  },
  ai: {
    label: 'AI 分析',
    routePath: '/ai',
    section: 'tools',
    icon: Sparkles,
    sortOrder: 41,
  },
}

/** Home and Settings are always shown, not from module registry */
export const FIXED_NAV = {
  home: {
    label: '首页',
    routePath: '/',
    section: 'workbench',
    icon: Home,
    sortOrder: 0,
  },
  settings: {
    label: '设置',
    routePath: '/settings',
    section: 'tools',
    icon: Settings,
    sortOrder: 99,
  },
}

export const DEFAULT_ENABLED_MODULE_IDS = [
  'schedule',
  'org-data',
  'biz-data',
  'opportunity',
  'competitor',
  'trip',
  'attendance',
  'links',
  'ai',
]
