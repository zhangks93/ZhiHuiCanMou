interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: string
  trendUp?: boolean
  color?: 'default' | 'success' | 'warning' | 'error'
  onClick?: () => void
}

const accentMap = {
  default: 'bg-[rgba(37,99,235,0.10)] text-[var(--color-accent)]',
  success: 'bg-[rgba(15,159,110,0.12)] text-[var(--color-success)]',
  warning: 'bg-[rgba(217,119,6,0.12)] text-[var(--color-warning)]',
  error: 'bg-[rgba(220,38,38,0.10)] text-[var(--color-error)]',
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
      className={[
        'app-card relative overflow-hidden p-5',
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : '',
      ].join(' ')}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.35)] to-transparent" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[var(--color-text-muted)]">{label}</div>
        <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${accentMap[color]}`}>
          Live
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-semibold text-[var(--color-text-strong)] sm:text-[2rem]">
          {value}
        </span>
        {unit && <span className="pb-1 text-sm text-[var(--color-text-muted)]">{unit}</span>}
      </div>

      {trend && (
        <div className={`mt-3 text-xs font-medium ${trendUp ? 'text-success-700' : 'text-error-700'}`}>
          {trend}
        </div>
      )}
    </div>
  )
}
