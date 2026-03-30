import { Filter } from 'lucide-react'

export interface LevelVisibility {
  level0: boolean
  level1: boolean
  level2: boolean
  level3: boolean
}

interface HierarchyLevelFilterProps {
  value: LevelVisibility
  onChange: (value: LevelVisibility) => void
}

export function HierarchyLevelFilter({ value, onChange }: HierarchyLevelFilterProps) {
  return (
    <div className="flex items-center justify-start gap-2 flex-wrap">
      <Filter size={13} className="text-[var(--color-text-muted)]" />
      <span className="text-caption font-medium text-[var(--color-text-muted)]">层级:</span>
      {[
        { key: 'level0', label: '集团' },
        { key: 'level1', label: '一级' },
        { key: 'level2', label: '二级' },
        { key: 'level3', label: '单元' },
      ].map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={value[key as keyof LevelVisibility]}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            className="radio w-3 h-3"
          />
          <span className="text-caption text-[var(--color-text-muted)]">{label}</span>
        </label>
      ))}
    </div>
  )
}
