import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/app/layout/MainLayout'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { PublicRoute } from '@/app/router/PublicRoute'
import { AppLoading } from '@/shared/ui/AppLoading'
import { ROUTES, buildDataHref, buildWorkspaceHref } from '@/app/config/constants'
import { DATA_MODULE_IDS } from '@/app/config/modules'

const Workspace = lazy(() => import('@/features/workspace').then(module => ({ default: module.WorkspacePage })))
const DataHub = lazy(() => import('@/features/data-hub').then(module => ({ default: module.DataHubPage })))
const AgentChat = lazy(() => import('@/features/agent-chat').then(module => ({ default: module.AgentChatFeaturePage })))
const Settings = lazy(() => import('@/features/settings').then(module => ({ default: module.SettingsPage })))
const Login = lazy(() => import('@/features/auth').then(module => ({ default: module.LoginPage })))
const AuthCallback = lazy(() => import('@/features/auth').then(module => ({ default: module.AuthCallbackPage })))
const DeepLinkTest = lazy(() => import('@/features/auth').then(module => ({ default: module.DeepLinkTestPage })))

const WORKSPACE_LEGACY_REDIRECTS = ['schedule', 'links'] as const

function withRouteSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<AppLoading variant="block" label="页面加载中..." />}>
      {element}
    </Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTES.LOGIN}
        element={(
          <PublicRoute>
            {withRouteSuspense(<Login />)}
          </PublicRoute>
        )}
      />
      <Route path={ROUTES.AUTH_CALLBACK} element={withRouteSuspense(<AuthCallback />)} />
      {import.meta.env.DEV ? (
        <Route path="/deep-link-test" element={withRouteSuspense(<DeepLinkTest />)} />
      ) : null}
      <Route
        path={ROUTES.HOME}
        element={(
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={withRouteSuspense(<Workspace />)} />
        <Route path="data" element={withRouteSuspense(<DataHub />)} />
        {WORKSPACE_LEGACY_REDIRECTS.map((tab) => (
          <Route
            key={tab}
            path={tab}
            element={<Navigate to={buildWorkspaceHref(tab)} replace />}
          />
        ))}
        {DATA_MODULE_IDS.map((moduleId) => (
          <Route
            key={moduleId}
            path={moduleId}
            element={<Navigate to={buildDataHref(moduleId)} replace />}
          />
        ))}
        <Route path="ai" element={withRouteSuspense(<AgentChat />)} />
        <Route path="ai/:agentId" element={withRouteSuspense(<AgentChat />)} />
        <Route path="settings" element={withRouteSuspense(<Settings />)} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Route>
    </Routes>
  )
}
