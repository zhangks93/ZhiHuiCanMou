import { Table2, BarChart3 } from 'lucide-react'
import { ToggleSwitch } from './ToggleSwitch'

interface ViewModeToggleProps {
  value: 'table' | 'chart'
  onChange: (mode: 'table' | 'chart') => void
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <ToggleSwitch
      value={value}
      onChange={onChange}
      options={[
        { value: 'chart', label: '图表', icon: <BarChart3 size={13} /> },
        { value: 'table', label: '表格', icon: <Table2 size={13} /> },
      ]}
    />
  )
}
