interface ToggleSwitchProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

export function ToggleSwitch<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: ToggleSwitchProps<T>) {
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-9 text-sm',
  }

  return (
    <div className={`inline-flex items-center bg-gray-100 rounded-lg p-0.5 ${sizeClasses[size]}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            flex items-center justify-center gap-1.5 px-3 rounded-md font-medium transition-all
            ${value === opt.value
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
