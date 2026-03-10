import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { MetricCategory } from '@/lib/supabase'
import { METRIC_LABELS } from '@/lib/constants'

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
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>
          指标选择 ({selectedMetrics.length}/{maxSelection})
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200">
            <p className="text-xs text-gray-500">
              最多选择 {maxSelection} 个指标
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {availableMetrics.map(metric => {
              const isSelected = selectedMetrics.includes(metric)
              const isDisabled = !isSelected && selectedMetrics.length >= maxSelection

              return (
                <button
                  key={metric}
                  onClick={() => !isDisabled && toggleMetric(metric)}
                  disabled={isDisabled}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors
                    ${isSelected
                      ? 'bg-primary-50 text-primary-700'
                      : isDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <div className={`
                    w-4 h-4 flex items-center justify-center rounded border
                    ${isSelected
                      ? 'bg-primary border-primary'
                      : 'border-gray-300'
                    }
                  `}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <span>{METRIC_LABELS[metric]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
