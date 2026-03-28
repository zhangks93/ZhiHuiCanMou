import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/app/layout/MainLayout'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { PublicRoute } from '@/app/router/PublicRoute'
import { AppLoading } from '@/shared/ui/AppLoading'
import { ROUTES } from '@/app/config/constants'

const Dashboard = lazy(() => import('@/features/dashboard').then(module => ({ default: module.DashboardPage })))
const Schedule = lazy(() => import('@/features/schedule').then(module => ({ default: module.SchedulePage })))
const OrgData = lazy(() => import('@/features/org').then(module => ({ default: module.OrgDataPage })))
const BizData = lazy(() => import('@/features/biz-data').then(module => ({ default: module.BizDataPage })))
const Opportunity = lazy(() => import('@/features/opportunity').then(module => ({ default: module.OpportunityPage })))
const Competitor = lazy(() => import('@/features/competitor').then(module => ({ default: module.CompetitorPage })))
const Trip = lazy(() => import('@/features/trip').then(module => ({ default: module.TripPage })))
const Attendance = lazy(() => import('@/features/attendance').then(module => ({ default: module.AttendancePage })))
const Links = lazy(() => import('@/features/links').then(module => ({ default: module.LinksPage })))
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
        <Route index element={withRouteSuspense(<Dashboard />)} />
        <Route path="schedule" element={withRouteSuspense(<Schedule />)} />
        <Route path="org-data" element={withRouteSuspense(<OrgData />)} />
        <Route path="biz-data" element={withRouteSuspense(<BizData />)} />
        <Route path="opportunity" element={withRouteSuspense(<Opportunity />)} />
        <Route path="competitor" element={withRouteSuspense(<Competitor />)} />
        <Route path="trip" element={withRouteSuspense(<Trip />)} />
        <Route path="attendance" element={withRouteSuspense(<Attendance />)} />
        <Route path="links" element={withRouteSuspense(<Links />)} />
        <Route path="ai" element={withRouteSuspense(<AgentChat />)} />
        <Route path="settings" element={withRouteSuspense(<Settings />)} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Route>
    </Routes>
  )
}
