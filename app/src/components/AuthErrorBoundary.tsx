import { Component, type ReactNode } from 'react'
import { createAuthError, type AuthError } from '@/lib/auth-errors'

interface Props {
  children: ReactNode
  fallback?: (error: AuthError, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: AuthError | null
}

/**
 * Error boundary specifically for authentication flows
 * Catches unexpected errors and provides recovery actions
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    const authError = createAuthError(error)
    return {
      hasError: true,
      error: authError,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AuthErrorBoundary] Caught error:', error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

export function DefaultErrorFallback({ error, reset }: { error: AuthError; reset: () => void }) {
  return (
    <div className="auth-error-boundary">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&family=Inter:wght@400;500;600&display=swap');

        .auth-error-boundary {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
        }

        .error-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          text-align: center;
        }

        .error-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          color: white;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
        }

        .error-title {
          font-family: 'Crimson Text', serif;
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.5rem;
        }

        .error-message {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #64748b;
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .error-suggestion {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #475569;
          margin-bottom: 2rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.05);
          border-radius: 12px;
          line-height: 1.6;
        }

        .error-actions {
          display: flex;
          gap: 0.75rem;
          flex-direction: column;
        }

        .error-button {
          width: 100%;
          padding: 0.875rem;
          border: none;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .error-button-primary {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.3);
        }

        .error-button-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.4);
        }

        .error-button-secondary {
          background: rgba(15, 23, 42, 0.05);
          color: #0f172a;
          border: 1px solid rgba(15, 23, 42, 0.1);
        }

        .error-button-secondary:hover {
          background: rgba(15, 23, 42, 0.1);
        }

        .error-button:active {
          transform: translateY(0);
        }

        @media (max-width: 640px) {
          .error-card {
            padding: 2.5rem 1.5rem;
          }

          .error-title {
            font-size: 20px;
          }

          .error-icon {
            width: 64px;
            height: 64px;
            font-size: 32px;
          }
        }
      `}</style>

      <div className="error-card">
        <div className="error-icon">✕</div>
        <h2 className="error-title">{error.title}</h2>
        <p className="error-message">{error.message}</p>
        <div className="error-suggestion">
          <strong>建议：</strong> {error.suggestion}
        </div>
        <div className="error-actions">
          {error.retryable && (
            <button
              className="error-button error-button-primary"
              onClick={() => {
                reset()
                window.location.reload()
              }}
            >
              重试
            </button>
          )}
          <button
            className="error-button error-button-secondary"
            onClick={() => {
              window.location.hash = '/'
            }}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
