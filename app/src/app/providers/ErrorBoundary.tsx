import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** 捕获子组件异常，避免白屏并显示错误信息 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Canmou] App error:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-base-200 p-8">
          <div className="max-w-md rounded-lg bg-base-100 p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-error">应用加载失败</h2>
            <p className="mb-4 text-sm text-base-content/80">{this.state.error.message}</p>
            <p className="text-xs text-base-content/60">
              按 F12 打开开发者工具可查看详细错误。若为打包版本，请确保已配置 .env 中的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
