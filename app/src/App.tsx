import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/Layout/MainLayout'
import { ProtectedRoute } from '@/components/routes/ProtectedRoute'
import { PublicRoute } from '@/components/routes/PublicRoute'
import { ROUTES } from '@/config/constants'
import {
  Dashboard,
  WorkReport,
  Schedule,
  OrgData,
  BizData,
  Opportunity,
  Competitor,
  Trip,
  Attendance,
  Links,
  AiAnalysis,
  Settings,
  Login,
  AuthCallback,
} from '@/pages'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
          <Route
            path={ROUTES.HOME}
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="work-report" element={<WorkReport />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="org-data" element={<OrgData />} />
            <Route path="biz-data" element={<BizData />} />
            <Route path="opportunity" element={<Opportunity />} />
            <Route path="competitor" element={<Competitor />} />
            <Route path="trip" element={<Trip />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="links" element={<Links />} />
            <Route path="ai" element={<AiAnalysis />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
