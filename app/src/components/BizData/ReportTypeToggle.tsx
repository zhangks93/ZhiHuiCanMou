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
        { value: 'fone', label: '学年预算', icon: <Target size={14} /> },
        { value: 'tuwei', label: '突围考核', icon: <TrendingUp size={14} /> },
      ]}
    />
  )
}
