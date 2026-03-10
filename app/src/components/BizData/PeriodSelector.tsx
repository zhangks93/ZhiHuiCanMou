import { ChevronDown } from 'lucide-react'

interface PeriodOption {
  period_type: 'cumulative' | 'monthly'
  period: string
  label: string
}

interface PeriodSelectorProps {
  value: string
  options: PeriodOption[]
  onChange: (period: string, periodType: 'cumulative' | 'monthly') => void
}

export function PeriodSelector({ value, options, onChange }: PeriodSelectorProps) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => {
          const selected = options.find(opt => opt.period === e.target.value)
          if (selected) {
            onChange(selected.period, selected.period_type)
          }
        }}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.period} value={opt.period}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
