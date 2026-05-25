import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { DataModuleId } from '@/app/config/modules'
import type { WorkspaceTab } from '@/features/workspace/workspaceTabs'

export interface ModuleRegistryEntry {
  component: LazyExoticComponent<ComponentType>
  contentClassName?: string
}

export const DATA_MODULE_REGISTRY: Record<DataModuleId, ModuleRegistryEntry> = {
  'biz-data': {
    component: lazy(() => import('@/features/biz-data').then((module) => ({ default: module.BizDataPage }))),
    contentClassName: 'app-tab-shell__content-biz-data',
  },
  collection: {
    component: lazy(() => import('@/features/collection').then((module) => ({ default: module.CollectionPage }))),
  },
  planning: {
    component: lazy(() => import('@/features/biz-data').then((module) => ({ default: module.PlanningPage }))),
  },
  opportunity: {
    component: lazy(() => import('@/features/opportunity').then((module) => ({ default: module.OpportunityPage }))),
  },
  trip: {
    component: lazy(() => import('@/features/trip').then((module) => ({ default: module.TripPage }))),
  },
  attendance: {
    component: lazy(() => import('@/features/attendance').then((module) => ({ default: module.AttendancePage }))),
  },
  'org-data': {
    component: lazy(() => import('@/features/org').then((module) => ({ default: module.OrgDataPage }))),
  },
}

export const WORKSPACE_TAB_REGISTRY: Record<WorkspaceTab, ModuleRegistryEntry> = {
  schedule: {
    component: lazy(() => import('@/features/schedule').then((module) => ({ default: module.SchedulePage }))),
  },
  inbox: {
    component: lazy(() => import('@/features/schedule').then((module) => ({ default: module.ScheduleInboxPage }))),
  },
  links: {
    component: lazy(() => import('@/features/links').then((module) => ({ default: module.LinksPage }))),
  },
}
