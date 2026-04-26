interface DataFreshnessBadgeProps {
  source: string
  updatedAt?: string | null
}

export function DataFreshnessBadge({ source, updatedAt }: DataFreshnessBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-caption text-[var(--color-text-muted)]">
      数据源：{source}{updatedAt ? ` · 更新至 ${updatedAt}` : ''}
    </span>
  )
}
