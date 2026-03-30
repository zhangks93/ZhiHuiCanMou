import { ChevronRight } from 'lucide-react'

interface ChartHierarchyBreadcrumbProps {
  items: Array<{ label: string }>
  onSelect: (index: number) => void
}

export function ChartHierarchyBreadcrumb({ items, onSelect }: ChartHierarchyBreadcrumbProps) {
  return (
    <div className="flex items-center justify-start gap-1 flex-wrap text-caption">
      <span className="mr-1 font-medium text-[var(--color-text-muted)]">层级:</span>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight size={12} className="text-[var(--color-text-muted)]" />}
          <button
            onClick={() => onSelect(index)}
            className={`
              px-2 py-1 rounded-lg transition-all duration-150
              ${index === items.length - 1
                ? 'bg-[var(--color-accent)] text-white font-medium shadow-[0_2px_8px_rgba(15,23,42,0.16)]'
                : 'text-[var(--color-text-muted)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)]'
              }
            `}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
