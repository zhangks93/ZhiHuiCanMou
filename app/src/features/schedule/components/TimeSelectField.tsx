import { ChevronDown } from 'lucide-react'
import type { Period } from '../api/scheduleRepository'
import { joinClockValue, parseClockValue, PERIOD_HOUR_OPTIONS, MINUTE_OPTIONS } from '../lib/scheduleTimeHelpers'

export function TimeSelectField({
  label,
  period,
  value,
  onChange,
}: {
  label: string
  period: Period
  value: string
  onChange: (value: string) => void
}) {
  const { hour, minute } = parseClockValue(value)
  const availableHours = PERIOD_HOUR_OPTIONS[period]

  const handleHourChange = (nextHour: string) => {
    onChange(nextHour ? joinClockValue(nextHour, minute || '00') : '')
  }

  const handleMinuteChange = (nextMinute: string) => {
    if (!hour) return
    onChange(joinClockValue(hour, nextMinute))
  }

  return (
    <div className="rounded-[20px] border border-[var(--color-border)] bg-white/72 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium text-[var(--color-text-muted)]">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-caption text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
          >
            清空
          </button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <label className="relative block">
          <select
            value={hour}
            onChange={(event) => handleHourChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.9)] px-3 pr-8 text-body text-[var(--color-text-strong)] outline-none transition-all focus:border-[rgba(95,127,188,0.32)] focus:ring-4 focus:ring-[rgba(95,127,188,0.08)]"
          >
            <option value="">时</option>
            {availableHours.map((option) => (
              <option key={option} value={option}>
                {option} 时
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        </label>
        <span className="text-subtitle font-medium text-[var(--color-text-muted)]">:</span>
        <label className="relative block">
          <select
            value={minute}
            onChange={(event) => handleMinuteChange(event.target.value)}
            disabled={!hour}
            className="h-11 w-full appearance-none rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.9)] px-3 pr-8 text-body text-[var(--color-text-strong)] outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[var(--color-text-muted)] focus:border-[rgba(95,127,188,0.32)] focus:ring-4 focus:ring-[rgba(95,127,188,0.08)]"
          >
            <option value="">分</option>
            {MINUTE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} 分
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        </label>
      </div>
    </div>
  )
}
