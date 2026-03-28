type AppLoadingVariant = 'screen' | 'overlay' | 'block' | 'inline'

interface AppLoadingProps {
  label?: string
  variant?: AppLoadingVariant
  className?: string
  contentClassName?: string
}

const VARIANT_CONTAINER_CLASS: Record<AppLoadingVariant, string> = {
  screen: 'relative flex min-h-screen items-center justify-center',
  overlay: 'fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.12)] backdrop-blur-lg animate-fade-in',
  block: 'flex items-center justify-center py-16',
  inline: 'flex items-center justify-center py-6',
}

const VARIANT_CONTENT_CLASS: Record<AppLoadingVariant, string> = {
  screen: 'flex flex-col items-center gap-5 animate-fade-in',
  overlay: 'flex flex-col items-center gap-5 rounded-[28px] border border-[var(--color-border)] bg-white/60 px-12 py-10 shadow-[0_24px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl animate-scale-in',
  block: 'flex flex-col items-center gap-3',
  inline: 'flex items-center gap-3',
}

const VARIANT_LABEL_CLASS: Record<AppLoadingVariant, string> = {
  screen: 'text-[12px] tracking-[0.1em] text-[var(--color-text-muted)]/70 animate-breathe',
  overlay: 'text-sm font-medium text-[var(--color-text-strong)]',
  block: 'text-sm text-[var(--color-text-muted)]',
  inline: 'text-sm text-[var(--color-text-muted)]',
}

export function AppLoading({
  label = '加载中...',
  variant = 'block',
  className = '',
  contentClassName = '',
}: AppLoadingProps) {
  const isLarge = variant === 'screen' || variant === 'overlay'

  return (
    <div className={`${VARIANT_CONTAINER_CLASS[variant]} ${className}`.trim()}>
      {variant === 'screen' && (
        <>
          <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />
          <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
            <div className="absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.10),transparent_65%)] animate-pulse-glow" />
            <div className="absolute -bottom-16 -left-16 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.07),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
          </div>
        </>
      )}

      <div className={`${VARIANT_CONTENT_CLASS[variant]} ${contentClassName}`.trim()}>
        {isLarge && (
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-950 text-xs font-semibold tracking-[0.2em] text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
              CM
            </div>
            <div
              className="absolute -inset-3 rounded-[26px] border border-[rgba(37,99,235,0.10)]"
              style={{ animation: 'orbit 16s linear infinite' }}
            />
          </div>
        )}

        <div
          className={[
            'animate-spin rounded-full border-[2.5px] border-[rgba(148,163,184,0.14)] border-t-[var(--color-accent)]',
            isLarge ? 'h-6 w-6' : variant === 'inline' ? 'h-4 w-4' : 'h-7 w-7',
          ].join(' ')}
        />

        <p className={VARIANT_LABEL_CLASS[variant]}>{label}</p>
      </div>
    </div>
  )
}
