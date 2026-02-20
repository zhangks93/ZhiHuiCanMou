interface PageTitleProps {
  breadcrumb?: string
  title: string
  subtitle?: string
}

export function PageTitle({ breadcrumb, title, subtitle }: PageTitleProps) {
  return (
    <div className="mb-6 animate-slide-up">
      {breadcrumb && (
        <div className="text-sm text-[var(--color-text-muted)] mb-0.5 font-medium">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text-strong)] font-serif tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
