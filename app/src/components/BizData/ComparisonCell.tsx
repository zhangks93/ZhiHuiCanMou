import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface ComparisonCellProps {
  actual: number | null
  budget: number | null
  completionRate: number | null
  diff: number | null
  yoy?: number | null
  mode: 'budget' | 'breakthrough' | 'yoy'
  isRate?: boolean  // 是否为比率类指标（如毛利率）
}

function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

function rateBg(rate: number | null | undefined): string {
  if (rate == null) return 'bg-gray-100 text-gray-500'
  if (rate >= 0.90) return 'bg-success-100 text-success-700'
  if (rate >= 0.70) return 'bg-warning-100 text-warning-700'
  return 'bg-error-100 text-error-700'
}

function diffArrow(v: number | null | undefined) {
  if (v == null || v === 0) return null
  return v > 0
    ? <ArrowUpRight size={14} className="text-success-700 inline ml-1" />
    : <ArrowDownRight size={14} className="text-error-700 inline ml-1" />
}

export function ComparisonCell({
  actual,
  budget,
  completionRate,
  diff,
  yoy,
  mode,
  isRate = false,
}: ComparisonCellProps) {
  const formatValue = isRate ? fmtPct : fmt

  if (mode === 'yoy') {
    // 同比对比模式
    const yoyDiff = actual != null && yoy != null ? actual - yoy : null

    return (
      <div className="text-right">
        <div className="font-medium text-gray-900">{formatValue(actual)}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          同期: {formatValue(yoy)}
          {yoyDiff != null && (
            <span className={yoyDiff >= 0 ? 'text-success-700' : 'text-error-700'}>
              {' '}({yoyDiff >= 0 ? '+' : ''}{formatValue(yoyDiff)})
            </span>
          )}
        </div>
      </div>
    )
  }

  // 预算对比 / 突围对比模式
  return (
    <div className="text-right">
      <div className="font-medium text-gray-900">{formatValue(actual)}</div>
      <div className="flex items-center justify-end gap-2 mt-1">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rateBg(completionRate)}`}>
          {fmtPct(completionRate)}
        </span>
        {diff != null && (
          <span className="text-xs text-gray-600">
            {diff >= 0 ? '+' : ''}{formatValue(diff)}
            {diffArrow(diff)}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {mode === 'budget' ? '预算' : '考核'}: {formatValue(budget)}
      </div>
    </div>
  )
}
