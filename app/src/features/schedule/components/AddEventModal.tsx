import { useState } from 'react'
import { X } from 'lucide-react'
import { AppButton } from '@/shared/ui/AppButton'
import type { ItemType, Period } from '../api/scheduleRepository'
import { PERIOD_LABEL, TYPE_LABEL } from '../lib/scheduleLabels'
import { alignTimeToPeriod, derivePeriodFromClock } from '../lib/scheduleTimeHelpers'
import { TimeSelectField } from './TimeSelectField'

export function AddEventModal({
  date,
  onClose,
  onSaved,
}: {
  date: string
  onClose: () => void
  onSaved: (input: {
    title: string
    period: Period
    type: ItemType
    description: string
    location: string
    startTime: string | null
    endTime: string | null
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<Period>('morning')
  const [type, setType] = useState<ItemType>('routine')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const hasPartialTime = Boolean(startTime) !== Boolean(endTime)
  const hasInvalidRange = Boolean(startTime && endTime) && endTime <= startTime
  const timeError = hasPartialTime
    ? '请同时填写开始和结束时间'
    : hasInvalidRange
      ? '结束时间需晚于开始时间'
      : null

  const handlePeriodChange = (nextPeriod: Period) => {
    setPeriod(nextPeriod)
    setStartTime((current) => alignTimeToPeriod(current, nextPeriod))
    setEndTime((current) => alignTimeToPeriod(current, nextPeriod))
  }

  const handleStartTimeChange = (value: string) => {
    setStartTime(value)

    const nextPeriod = derivePeriodFromClock(value)
    if (nextPeriod) {
      setPeriod(nextPeriod)
      setEndTime((current) => alignTimeToPeriod(current, nextPeriod))
    }
  }

  const handleEndTimeChange = (value: string) => {
    setEndTime(value)

    const nextPeriod = derivePeriodFromClock(value)
    if (nextPeriod) {
      setPeriod(nextPeriod)
      setStartTime((current) => alignTimeToPeriod(current, nextPeriod))
    }
  }

  const handleSave = async () => {
    if (!title.trim() || timeError) return

    setSaving(true)
    try {
      await onSaved({
        title,
        period,
        type,
        description,
        location,
        startTime: startTime || null,
        endTime: endTime || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const granularityHint = `\u5f53\u524d\u4e3a\u201c${PERIOD_LABEL[period]}\u201d\u65f6\u6bb5\uff0c\u65f6\u95f4\u9009\u9879\u5df2\u8054\u52a8\u7b5b\u9009\u4e3a 15 \u5206\u7c92\u5ea6`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[var(--color-text-strong)]">添加日程 · {date}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="日程标题" className="input input-bordered w-full text-body" />
          <div className="flex gap-2">
            {(['morning', 'afternoon', 'evening'] as Period[]).map((value) => (
              <button
                key={value}
                onClick={() => handlePeriodChange(value)}
                className={`flex-1 py-1.5 rounded-lg text-caption font-medium transition-colors ${period === value ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {PERIOD_LABEL[value]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TimeSelectField label="\u5f00\u59cb\u65f6\u95f4" period={period} value={startTime} onChange={handleStartTimeChange} />
            <TimeSelectField label="\u7ed3\u675f\u65f6\u95f4" period={period} value={endTime} onChange={handleEndTimeChange} />
          </div>
          <p className={`text-caption ${timeError ? 'text-error' : 'text-gray-400'}`}>
            {timeError || granularityHint}
          </p>
          <div className="flex gap-2">
            {(['meeting', 'business', 'routine', 'urgent'] as ItemType[]).map((value) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={`flex-1 py-1.5 rounded-lg text-caption font-medium transition-colors ${type === value ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {TYPE_LABEL[value]}
              </button>
            ))}
          </div>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="\u5730\u70b9\uff08\u53ef\u9009\uff09" className="input input-bordered w-full text-body" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="\u63cf\u8ff0\uff08\u53ef\u9009\uff09" className="textarea textarea-bordered w-full text-body" rows={2} />
          <AppButton onClick={handleSave} disabled={saving || !title.trim() || Boolean(timeError)} variant="primary" size="sm" className="w-full">
            {saving ? '\u4fdd\u5b58\u4e2d...' : '\u6dfb\u52a0'}
          </AppButton>
        </div>
      </div>
    </div>
  )
}