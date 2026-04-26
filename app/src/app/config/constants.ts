/**
 * Application constants
 */

import type { DataModuleId } from '@/app/config/modules'

export const APP_NAME = '智汇参谋'
export const APP_DESCRIPTION = '企业智能助手'

export const ROUTES = {
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth-callback',
  HOME: '/',
  DATA: '/data',
  SCHEDULE: '/schedule',
  ORG_DATA: '/org-data',
  PLANNING: '/planning',
  BIZ_DATA: '/biz-data',
  OPPORTUNITY: '/opportunity',
  TRIP: '/trip',
  ATTENDANCE: '/attendance',
  LINKS: '/links',
  AI_ANALYSIS: '/ai',
  SETTINGS: '/settings',
} as const

export function buildWorkspaceHref(tab?: 'briefing' | 'schedule' | 'inbox' | 'links') {
  if (!tab) return ROUTES.HOME
  return `${ROUTES.HOME}?tab=${tab}`
}

export function buildDataHref(
  tab: DataModuleId = 'org-data',
) {
  return `${ROUTES.DATA}?tab=${tab}`
}

export function buildAgentChatHref(agentId: string) {
  return `${ROUTES.AI_ANALYSIS}/${agentId}`
}

export function buildSettingsHref(tab: 'thresholds' | 'ai-model' = 'thresholds') {
  if (tab === 'thresholds') return ROUTES.SETTINGS
  return `${ROUTES.SETTINGS}?tab=${tab}`
}
