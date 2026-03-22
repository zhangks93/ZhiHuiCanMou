import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { MetricCategory } from '@/lib/supabase'
import { METRIC_LABELS, METRIC_GROUPS } from '@/lib/constants'

interface MetricSelectorProps {
  selectedMetrics: MetricCategory[]
  onChange: (metrics: MetricCategory[]) => void
  availableMetrics: MetricCategory[]
  maxSelection?: number
}

export function MetricSelector({
  selectedMetrics,
  onChange,
  availableMetrics,
  maxSelection = 6,
}: MetricSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleMetric = (metric: MetricCategory) => {
    if (selectedMetrics.includes(metric)) {
      onChange(selectedMetrics.filter(m => m !== metric))
    } else {
      if (selectedMetrics.length >= maxSelection) {
        return
      }
      onChange([...selectedMetrics, metric])
    }
  }

  return (
    <div className="relative inline-block" ref={dropdownRef} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-[rgba(15,23,42,0.06)] text-[var(--color-text)] hover:bg-[rgba(15,23,42,0.1)] transition-colors"
      >
        <span>
          指标 {selectedMetrics.length}/{maxSelection}
        </span>
        <ChevronDown size={14} className={`transition-transform text-[var(--color-text-muted)] ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl border border-[var(--color-border)] bg-white/96 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl" style={{ zIndex: 9999 }}>
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              最多选择 {maxSelection} 个指标
            </p>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-1.5">
            {METRIC_GROUPS.map((group, groupIdx) => {
              const groupMetrics = group.metrics.filter(m => availableMetrics.includes(m))
              if (groupMetrics.length === 0) return null

              return (
                <div key={groupIdx} className="mb-2 last:mb-0">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    {group.label}
                  </div>
                  <div className="space-y-px">
                    {groupMetrics.map(metric => {
                      const isSelected = selectedMetrics.includes(metric)
                      const isDisabled = !isSelected && selectedMetrics.length >= maxSelection

                      return (
                        <button
                          key={metric}
                          onClick={() => !isDisabled && toggleMetric(metric)}
                          disabled={isDisabled}
                          className={`
                            w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all duration-150
                            ${isSelected
                              ? 'bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)]'
                              : isDisabled
                              ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-40'
                              : 'text-[var(--color-text)] hover:bg-[rgba(15,23,42,0.04)]'
                            }
                          `}
                        >
                          <div className={`
                            w-3.5 h-3.5 flex items-center justify-center rounded shrink-0 transition-colors
                            ${isSelected
                              ? 'bg-[var(--color-accent)]'
                              : 'border border-[var(--color-border-strong)]'
                            }
                          `}>
                            {isSelected && <Check size={10} className="text-white" />}
                          </div>
                          <span>{METRIC_LABELS[metric]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
