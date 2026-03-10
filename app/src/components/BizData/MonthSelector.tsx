import { Calendar } from 'lucide-react'

interface MonthSelectorProps {
  value: string
  options: string[]
  onChange: (month: string) => void
}

export function MonthSelector({ value, options, onChange }: MonthSelectorProps) {
  const formatMonth = (month: string) => {
    // Handle different period formats:
    // - Monthly: 202601 -> 2026年1月
    // - Cumulative fone: <202603 -> 截至2026年3月
    // - Cumulative tuwei: 202601-202602- -> 2026年1-2月

    if (month.startsWith('<')) {
      // Cumulative fone format: <202603
      const periodStr = month.substring(1)
      if (periodStr.length === 6) {
        const year = periodStr.substring(0, 4)
        const monthNum = parseInt(periodStr.substring(4, 6), 10)
        return `截至${year}年${monthNum}月`
      }
    } else if (month.includes('-')) {
      // Cumulative tuwei format: 202601-202602-
      const parts = month.split('-').filter(p => p.length === 6)
      if (parts.length >= 2) {
        const startYear = parts[0].substring(0, 4)
        const startMonth = parseInt(parts[0].substring(4, 6), 10)
        const endMonth = parseInt(parts[1].substring(4, 6), 10)
        return `${startYear}年${startMonth}-${endMonth}月`
      }
    } else if (month.length === 6) {
      // Monthly format: 202601
      const year = month.substring(0, 4)
      const monthNum = parseInt(month.substring(4, 6), 10)
      return `${year}年${monthNum}月`
    }

    return month
  }

  return (
    <div className="relative inline-flex items-center">
      <Calendar size={14} className="absolute left-3 text-gray-400 pointer-events-none z-10" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-colors"
      >
        {options.map(month => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
