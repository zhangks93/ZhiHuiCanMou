import type { FeishuCliHealth } from '@/shared/lib/feishu/feishuClient'

export function FeishuCliErrorBanner({ feishuStatusError, feishuHealth }: { feishuStatusError: string | null; feishuHealth: FeishuCliHealth | null }) {
  if (!feishuStatusError && !feishuHealth?.error) return null
  return (
    <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-body text-warning-800">
      {feishuStatusError || feishuHealth?.error}
    </div>
  )
}
