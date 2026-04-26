interface ActiveFiltersSummaryProps {
  filters: string[]
}

export function ActiveFiltersSummary({ filters }: ActiveFiltersSummaryProps) {
  if (filters.length === 0) {
    return null
  }

  return (
    <div className="text-caption text-[var(--color-text-muted)]">
      当前筛选：{filters.join(' · ')}
    </div>
  )
}
