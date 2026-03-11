interface PageTitleProps {
  breadcrumb?: string
  title?: string // Keep for backward compatibility but won't be displayed
  subtitle?: string
}

export function PageTitle({ breadcrumb, subtitle }: PageTitleProps) {
  return (
    <div className="mb-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {breadcrumb && (
          <div className="text-sm text-[var(--color-text-muted)] font-medium">
            {breadcrumb}
          </div>
        )}
        {subtitle && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
