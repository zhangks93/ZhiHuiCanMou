import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

type PaginationToken = number | '…'

interface AppPaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}

function buildPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens: PaginationToken[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) {
    tokens.push('…')
  }

  for (let index = start; index <= end; index += 1) {
    tokens.push(index)
  }

  if (end < totalPages - 1) {
    tokens.push('…')
  }

  tokens.push(totalPages)
  return tokens
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="app-pagination-button"
    >
      {children}
    </button>
  )
}

export function AppPagination({
  page,
  total,
  pageSize,
  onChange,
  className = '',
}: AppPaginationProps) {
  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) {
    return null
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pageTokens = buildPageTokens(page, totalPages)

  return (
    <div className={`app-pagination ${className}`.trim()}>
      <div className="app-pagination-summary">
        {from} - {to} / 共 <span className="font-semibold text-[var(--color-text-strong)]">{total}</span> 条
      </div>

      <div className="app-pagination-controls">
        <IconButton label="首页" disabled={page === 1} onClick={() => onChange(1)}>
          <ChevronsLeft size={14} />
        </IconButton>
        <IconButton label="上一页" disabled={page === 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={14} />
        </IconButton>

        <div className="app-pagination-pages">
          {pageTokens.map((token, index) =>
            token === '…' ? (
              <span key={`ellipsis-${index}`} className="app-pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onChange(token)}
                className={`app-pagination-page ${token === page ? 'is-active' : ''}`}
              >
                {token}
              </button>
            ),
          )}
        </div>

        <IconButton label="下一页" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={14} />
        </IconButton>
        <IconButton label="末页" disabled={page === totalPages} onClick={() => onChange(totalPages)}>
          <ChevronsRight size={14} />
        </IconButton>
      </div>
    </div>
  )
}
