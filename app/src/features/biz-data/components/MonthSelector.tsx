import { Calendar } from 'lucide-react'

interface MonthSelectorProps {
  value: string
  options: string[]
  onChange: (month: string) => void
}

export function MonthSelector({ value, options, onChange }: MonthSelectorProps) {
  const formatMonth = (month: string) => {
    if (month.startsWith('<')) {
      const periodStr = month.substring(1)
      if (periodStr.length === 6) {
        const year = periodStr.substring(0, 4)
        const monthNum = parseInt(periodStr.substring(4, 6), 10)
        return `截至${year}年${monthNum}月`
      }
    } else if (month.includes('-')) {
      const parts = month.split('-').filter(p => p.length === 6)
      if (parts.length >= 2) {
        const startYear = parts[0].substring(0, 4)
        const startMonth = parseInt(parts[0].substring(4, 6), 10)
        const endMonth = parseInt(parts[1].substring(4, 6), 10)
        return `${startYear}年${startMonth}-${endMonth}月`
      }
    } else if (month.length === 6) {
      const year = month.substring(0, 4)
      const monthNum = parseInt(month.substring(4, 6), 10)
      return `${year}年${monthNum}月`
    }

    return month
  }

  return (
    <div className="relative inline-flex items-center">
      <Calendar size={13} className="absolute left-2.5 text-[var(--color-accent)] pointer-events-none z-10" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-8 pl-8 pr-7 rounded-full text-caption font-medium bg-[rgba(15,23,42,0.06)] border-0 text-[var(--color-text-strong)] cursor-pointer hover:bg-[rgba(15,23,42,0.1)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
      >
        {options.map(month => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
