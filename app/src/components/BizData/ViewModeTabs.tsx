interface ViewModeTabsProps {
  value: 'table' | 'chart'
  onChange: (value: 'table' | 'chart') => void
}

export function ViewModeTabs({ value, onChange }: ViewModeTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <div className="flex gap-6">
        <button
          onClick={() => onChange('table')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            value === 'table'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          表格视图
        </button>
        <button
          onClick={() => onChange('chart')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            value === 'chart'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          图表视图
        </button>
      </div>
    </div>
  )
}
