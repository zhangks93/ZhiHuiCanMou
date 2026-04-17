import logoUrl from '@/assets/logo.png'

type BrandMarkSize = 'sm' | 'md' | 'lg'
type BrandMarkTone = 'accent' | 'success' | 'error'

interface AppBrandMarkProps {
  size?: BrandMarkSize
  className?: string
  ringTone?: BrandMarkTone
  animated?: boolean
}

const SIZE_CLASS: Record<BrandMarkSize, { shell: string; ring: string; image: string; pixels: number }> = {
  sm: {
    shell: 'h-11 w-11 rounded-2xl',
    ring: '-inset-2 rounded-[22px]',
    image: 'h-11 w-11',
    pixels: 44,
  },
  md: {
    shell: 'h-14 w-14 rounded-[18px]',
    ring: '-inset-2.5 rounded-[26px]',
    image: 'h-14 w-14',
    pixels: 56,
  },
  lg: {
    shell: 'h-16 w-16 rounded-[22px]',
    ring: '-inset-3 rounded-[30px]',
    image: 'h-16 w-16',
    pixels: 64,
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
      <div className={`relative overflow-hidden border border-white/35 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.12)] ${preset.shell}`}>
        <img
          src={logoUrl}
          alt="智汇参谋 Logo"
          className={`relative z-10 object-cover ${preset.image}`}
          width={preset.pixels}
          height={preset.pixels}
          decoding="async"
          draggable={false}
        />
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
