type BrandMarkSize = 'sm' | 'md' | 'lg'
type BrandMarkTone = 'accent' | 'success' | 'error'

interface AppBrandMarkProps {
  size?: BrandMarkSize
  className?: string
  ringTone?: BrandMarkTone
  animated?: boolean
}

const SIZE_CLASS: Record<BrandMarkSize, { shell: string; ring: string; icon: string }> = {
  sm: {
    shell: 'h-11 w-11 rounded-2xl',
    ring: '-inset-2 rounded-[22px]',
    icon: 'h-6 w-6',
  },
  md: {
    shell: 'h-14 w-14 rounded-[18px]',
    ring: '-inset-2.5 rounded-[26px]',
    icon: 'h-8 w-8',
  },
  lg: {
    shell: 'h-16 w-16 rounded-[22px]',
    ring: '-inset-3 rounded-[30px]',
    icon: 'h-9 w-9',
  },
}

const RING_TONE_CLASS: Record<BrandMarkTone, string> = {
  accent: 'border-[rgba(95,127,188,0.18)]',
  success: 'border-[rgba(15,159,110,0.22)]',
  error: 'border-[rgba(220,38,38,0.18)]',
}

export function AppBrandMark({
  size = 'sm',
  className = '',
  ringTone,
  animated = false,
}: AppBrandMarkProps) {
  const preset = SIZE_CLASS[size]

  return (
    <div className={`relative ${className}`.trim()}>
      <div className={`relative flex items-center justify-center overflow-hidden border border-white/10 bg-[linear-gradient(150deg,#182435_0%,#2a3d56_48%,#5f7fbc_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.18)] ${preset.shell}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.28),transparent_42%)]" />
        <div className="absolute inset-x-1.5 top-0 h-px bg-white/30" />
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          className={`relative z-10 ${preset.icon}`}
          fill="none"
        >
          <path
            d="M16 6.5L23.25 10.75V20.25L16 24.5L8.75 20.25V10.75L16 6.5Z"
            stroke="rgba(255,255,255,0.78)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8.75 10.75L16 15M23.25 10.75L16 15M16 15V24.5"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="16" cy="6.5" r="1.6" fill="#dbeafe" />
          <circle cx="8.75" cy="10.75" r="1.45" fill="#93c5fd" />
          <circle cx="23.25" cy="10.75" r="1.45" fill="#bfdbfe" />
          <circle cx="16" cy="15" r="2.15" fill="white" />
          <circle cx="16" cy="24.5" r="1.55" fill="#7dd3fc" />
        </svg>
      </div>

      {ringTone && (
        <div
          className={[
            'pointer-events-none absolute border',
            preset.ring,
            RING_TONE_CLASS[ringTone],
          ].join(' ')}
          style={animated ? { animation: 'orbit 16s linear infinite' } : undefined}
        />
      )}
    </div>
  )
}
