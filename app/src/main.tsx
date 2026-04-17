import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { validateEnv } from '@/app/config/env'
import { ErrorBoundary } from '@/app/providers/ErrorBoundary'
import { initializeSettingsStore } from '@/shared/lib/settingsStore'
import '@/shared/styles/tokens.css'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
  validateEnv()

  try {
    await initializeSettingsStore()
  } catch (error) {
    console.error('[SettingsStore] Failed to initialize persisted settings:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
