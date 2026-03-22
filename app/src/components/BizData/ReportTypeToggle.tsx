import { Target, TrendingUp } from 'lucide-react'
import { ToggleSwitch } from './ToggleSwitch'

interface ReportTypeToggleProps {
  value: 'fone' | 'tuwei'
  onChange: (value: 'fone' | 'tuwei') => void
}

export function ReportTypeToggle({ value, onChange }: ReportTypeToggleProps) {
  return (
    <ToggleSwitch
      value={value}
      onChange={onChange}
      options={[
        { value: 'fone', label: '预算', icon: <Target size={13} /> },
        { value: 'tuwei', label: '突围', icon: <TrendingUp size={13} /> },
      ]}
    />
  )
}
