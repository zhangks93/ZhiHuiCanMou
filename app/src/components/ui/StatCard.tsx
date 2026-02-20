interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: string
  trendUp?: boolean
  color?: 'default' | 'success' | 'warning' | 'error'
  onClick?: () => void
}

const colorMap = {
  default: 'border-t-accent',
  success: 'border-t-success',
  warning: 'border-t-warning',
  error: 'border-t-error',
}

const trendColorMap = {
  up: 'text-success-700',
  down: 'text-error',
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  trendUp,
  color = 'default',
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-surface border border-[var(--color-border)] rounded-xl p-5 relative overflow-hidden
        border-t-[3px] ${colorMap[color]}
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5' : 'shadow-card'}
      `}
    >
      <div className="text-sm text-[var(--color-text-muted)] mb-1.5 font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-[var(--color-text-strong)] font-serif">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-[var(--color-text-muted)]">{unit}</span>
        )}
      </div>
      {trend && (
        <div className={`text-xs mt-2.5 font-medium ${trendUp ? trendColorMap.up : trendColorMap.down}`}>
          {trend}
        </div>
      )}
    </div>
  )
}
