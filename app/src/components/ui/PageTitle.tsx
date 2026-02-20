interface PageTitleProps {
  breadcrumb?: string
  title: string
  subtitle?: string
}

export function PageTitle({ breadcrumb, title, subtitle }: PageTitleProps) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <div className="text-sm text-gray-500 mb-0.5">{breadcrumb}</div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <span className="text-sm text-gray-500">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
