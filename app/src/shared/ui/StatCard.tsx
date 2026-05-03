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
  default: 'bg-[var(--color-selected-bg)] text-[var(--color-accent-hover)]',
  success: 'bg-success-100 text-[var(--color-success-text)]',
  warning: 'bg-warning-100 text-[var(--color-warning-text)]',
  error: 'bg-error-100 text-[var(--color-error-text)]',
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
        'relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/90 px-4 py-3 transition-all duration-200',
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]' : '',
      ].join(' ')}
    >
      {/* Top accent line */}
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(95,127,188,0.24)] to-transparent" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-caption font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {label}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-title font-semibold text-[var(--color-text-strong)]">
              {value}
            </span>
            {unit ? <span className="text-caption text-[var(--color-text-muted)]">{unit}</span> : null}
          </div>
        </div>

        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-bold uppercase tracking-[0.06em] ${accentMap[color]}`}>
          Live
        </span>
      </div>

      {trend ? (
        <div className={`mt-1.5 text-caption font-medium ${trendUp ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'}`}>
          {trend}
        </div>
      ) : null}
    </div>
  )
}
