import { fmt, fmtPct } from '@/shared/lib/format'

interface ThresholdCompletionCellProps {
  displayCompletionRate: number | null
  colorClass: string
  bgClass: string
  borderClass: string
  helperText: string | null
}

export function ThresholdCompletionCell({
  displayCompletionRate,
  colorClass,
  bgClass,
  borderClass,
  helperText,
}: ThresholdCompletionCellProps) {
  return (
    <div className="text-right">
      <div
        className={`inline-flex items-center px-2 py-0.5 rounded-lg border ${bgClass} ${borderClass}`}
        title={helperText ?? undefined}
      >
        <span className={`font-semibold ${colorClass}`}>
          {fmtPct(displayCompletionRate)}
        </span>
      </div>
    </div>
  )
}

interface MetricValueCellsProps {
  actual: number | null
  budget: number | null
  displayCompletionRate: number | null
  colorClass: string
  bgClass: string
  borderClass: string
  helperText: string | null
}

export function MetricTripleValueCells({
  actual,
  budget,
  displayCompletionRate,
  colorClass,
  bgClass,
  borderClass,
  helperText,
}: MetricValueCellsProps) {
  return (
    <div className="grid h-full grid-cols-3 items-center gap-1.5 px-3">
      <div className="text-right">
        <span className="font-medium text-[var(--color-text-strong)]">{fmt(actual)}</span>
      </div>
      <div className="text-right">
        <span className="text-[var(--color-text-muted)]">{fmt(budget)}</span>
      </div>
      <ThresholdCompletionCell
        displayCompletionRate={displayCompletionRate}
        colorClass={colorClass}
        bgClass={bgClass}
        borderClass={borderClass}
        helperText={helperText}
      />
    </div>
  )
}
