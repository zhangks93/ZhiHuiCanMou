import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/app/layout/MainLayout'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { PublicRoute } from '@/app/router/PublicRoute'
import { AppLoading } from '@/shared/ui/AppLoading'
import { ROUTES, buildDataHref, buildWorkspaceHref } from '@/app/config/constants'

const Workspace = lazy(() => import('@/features/workspace').then(module => ({ default: module.WorkspacePage })))
const DataHub = lazy(() => import('@/features/data-hub').then(module => ({ default: module.DataHubPage })))
const AgentChat = lazy(() => import('@/features/agent-chat').then(module => ({ default: module.AgentChatFeaturePage })))
const Settings = lazy(() => import('@/features/settings').then(module => ({ default: module.SettingsPage })))
const Login = lazy(() => import('@/features/auth').then(module => ({ default: module.LoginPage })))
const AuthCallback = lazy(() => import('@/features/auth').then(module => ({ default: module.AuthCallbackPage })))
const DeepLinkTest = lazy(() => import('@/features/auth').then(module => ({ default: module.DeepLinkTestPage })))

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
      <Route path="/deep-link-test" element={withRouteSuspense(<DeepLinkTest />)} />
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
        <Route path="schedule" element={<Navigate to={buildWorkspaceHref('schedule')} replace />} />
        <Route path="links" element={<Navigate to={buildWorkspaceHref('links')} replace />} />
        <Route path="org-data" element={<Navigate to={buildDataHref('org-data')} replace />} />
        <Route path="biz-data" element={<Navigate to={buildDataHref('biz-data')} replace />} />
        <Route path="opportunity" element={<Navigate to={buildDataHref('opportunity')} replace />} />
        <Route path="competitor" element={<Navigate to={buildDataHref('competitor')} replace />} />
        <Route path="trip" element={<Navigate to={buildDataHref('trip')} replace />} />
        <Route path="attendance" element={<Navigate to={buildDataHref('attendance')} replace />} />
        <Route path="ai" element={withRouteSuspense(<AgentChat />)} />
        <Route path="ai/:agentId" element={withRouteSuspense(<AgentChat />)} />
        <Route path="settings" element={withRouteSuspense(<Settings />)} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Route>
    </Routes>
  )
}
