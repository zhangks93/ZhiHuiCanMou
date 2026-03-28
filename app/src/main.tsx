import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { validateEnv } from '@/app/config/env'
import { ErrorBoundary } from '@/app/providers/ErrorBoundary'
import '@/shared/styles/tokens.css'
import './index.css'
import App from './App.tsx'

validateEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
