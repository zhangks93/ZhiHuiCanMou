interface ReportTypeToggleProps {
  value: 'fone' | 'tuwei' | 'comparison'
  onChange: (value: 'fone' | 'tuwei' | 'comparison') => void
}

export function ReportTypeToggle({ value, onChange }: ReportTypeToggleProps) {
  const options: Array<{ value: 'fone' | 'tuwei' | 'comparison'; label: string }> = [
    { value: 'comparison', label: '对比视图' },
    { value: 'fone', label: '年初预算' },
    { value: 'tuwei', label: '突围考核' },
  ]

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
