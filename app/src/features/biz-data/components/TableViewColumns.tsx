import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { METRIC_LABELS } from '@/shared/lib/constants'
import type { MetricCategory } from '@/features/biz-data/types'

export const BUSINESS_UNIT_COLUMN_WIDTH = 288
export const METRIC_GROUP_WIDTH = 300
export const MOBILE_BREAKPOINT = 768

export const HEADER_CONTENT_CLASS =
  'flex min-h-[84px] flex-col justify-center gap-1.5 px-3 py-3'

export function DraggableHeader({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${HEADER_CONTENT_CLASS} relative group`}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="拖动调整顺序"
        >
          <GripVertical size={14} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]" />
        </button>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export function BizUnitCornerHeaderCell({ businessUnitColumnWidth }: { businessUnitColumnWidth: number }) {
  return (
    <th
      className="biz-data-table__sticky-header biz-data-table__sticky-corner !p-0"
      style={{
        width: `${businessUnitColumnWidth}px`,
        minWidth: `${businessUnitColumnWidth}px`,
        maxWidth: `${businessUnitColumnWidth}px`,
      }}
    >
      <div className={`${HEADER_CONTENT_CLASS} items-center`}>
        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          业务单元
        </span>
        <div className="text-caption font-medium text-transparent">占位</div>
      </div>
    </th>
  )
}

interface MetricDragHeadersProps {
  metricOrder: MetricCategory[]
  metricGroupWidth: number
}

export function MetricDragHeadersRow({ metricOrder, metricGroupWidth }: MetricDragHeadersProps) {
  return (
    <>
      {metricOrder.map((metric) => (
        <th
          key={metric}
          className="biz-data-table__sticky-header !p-0"
          style={{
            width: `${metricGroupWidth}px`,
            minWidth: `${metricGroupWidth}px`,
            maxWidth: `${metricGroupWidth}px`,
          }}
        >
          <DraggableHeader id={metric}>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                {METRIC_LABELS[metric]}
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-caption font-medium text-[var(--color-text-muted)]">
                <span className="text-center">实际</span>
                <span className="text-center">预算</span>
                <span className="text-center">完成率</span>
              </div>
            </div>
          </DraggableHeader>
        </th>
      ))}
    </>
  )
}
