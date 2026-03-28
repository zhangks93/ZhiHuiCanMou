import { Calendar, CalendarDays } from 'lucide-react'
import { ToggleSwitch } from './ToggleSwitch'

interface PeriodTypeToggleProps {
  value: 'cumulative' | 'monthly'
  onChange: (value: 'cumulative' | 'monthly') => void
}

export function PeriodTypeToggle({ value, onChange }: PeriodTypeToggleProps) {
  return (
    <ToggleSwitch
      value={value}
      onChange={onChange}
      options={[
        { value: 'cumulative', label: '累计', icon: <Calendar size={13} /> },
        { value: 'monthly', label: '当月', icon: <CalendarDays size={13} /> },
      ]}
    />
  )
}
