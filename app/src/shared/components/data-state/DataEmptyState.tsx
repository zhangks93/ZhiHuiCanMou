import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface DataEmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function DataEmptyState({ title, description, action }: DataEmptyStateProps) {
  return (
    <div className="app-empty-state px-6 py-10">
      <Inbox size={30} className="opacity-50" />
      <div className="text-body font-medium text-[var(--color-text-strong)]">{title}</div>
      {description ? <div className="text-caption text-[var(--color-text-muted)]">{description}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}
