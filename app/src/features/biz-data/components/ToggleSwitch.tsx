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
    sm: 'h-7 text-caption',
    md: 'h-8 text-caption',
  }

  return (
    <div className={`inline-flex max-w-full flex-wrap items-center rounded-full bg-[rgba(15,23,42,0.06)] p-0.5 ${sizeClasses[size]}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            flex min-w-0 items-center justify-center gap-1 px-2.5 rounded-full font-medium transition-all duration-200 h-full
            ${value === opt.value
              ? 'bg-[var(--color-accent)] text-white shadow-[0_2px_8px_rgba(15,23,42,0.16)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'
            }
          `}
        >
          {opt.icon}
          <span className="truncate">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
