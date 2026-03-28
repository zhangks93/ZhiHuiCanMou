import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppRoutes } from '@/app/router/routes'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

export default App
