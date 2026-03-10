interface ComparisonTabsProps {
  value: 'budget' | 'breakthrough' | 'yoy' | 'monthly'
  onChange: (value: 'budget' | 'breakthrough' | 'yoy' | 'monthly') => void
}

export function ComparisonTabs({ value, onChange }: ComparisonTabsProps) {
  const tabs: Array<{ value: 'budget' | 'breakthrough' | 'yoy' | 'monthly'; label: string }> = [
    { value: 'budget', label: '预算对比' },
    { value: 'breakthrough', label: '突围对比' },
    { value: 'yoy', label: '同比对比' },
    { value: 'monthly', label: '月度趋势' },
  ]

  return (
    <div className="border-b border-gray-200">
      <div className="flex gap-6">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              value === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
