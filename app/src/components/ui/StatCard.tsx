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
  default: 'border-t-primary',
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
        bg-surface border border-gray-200 rounded-lg p-4 relative overflow-hidden shadow-card
        border-t-[3px] ${colorMap[color]}
        transition-shadow duration-150
        ${onClick ? 'cursor-pointer hover:shadow-card-hover' : ''}
      `}
    >
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {trend && (
        <div className={`text-xs mt-2 ${trendUp ? trendColorMap.up : trendColorMap.down}`}>
          {trend}
        </div>
      )}
    </div>
  )
}
