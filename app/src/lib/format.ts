export function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

export function getCompletionColor(rate: number | null | undefined): string {
  if (rate == null) return 'text-gray-400'
  if (rate >= 0.9) return 'text-success-600'
  if (rate >= 0.7) return 'text-warning-600'
  return 'text-error-600'
}

export function getCompletionBgColor(rate: number | null | undefined): string {
  if (rate == null) return 'bg-gray-100'
  if (rate >= 0.9) return 'bg-success-100'
  if (rate >= 0.7) return 'bg-warning-100'
  return 'bg-error-100'
}
