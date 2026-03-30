import { useMemo, useState } from 'react'
import { Calendar, Plus, Trash2, FileText, X, Sun, Sunset, Moon } from 'lucide-react'
import { useScheduleData } from '../hooks/useScheduleData'
import type { ItemType, Period, ScheduleItem } from '../api/scheduleRepository'

const PERIOD_LABEL: Record<Period, string> = { morning: '上午', afternoon: '下午', evening: '晚上' }
const PERIOD_ICON: Record<Period, typeof Sun> = { morning: Sun, afternoon: Sunset, evening: Moon }
const TYPE_LABEL: Record<ItemType, string> = { meeting: '会议', business: '商务', routine: '例行', urgent: '紧急' }
const TYPE_COLOR: Record<ItemType, string> = {
  meeting: 'bg-accent-100 text-accent-700',
  business: 'bg-primary-100 text-primary-700',
  routine: 'bg-gray-100 text-gray-600',
  urgent: 'bg-error-100 text-error-700',
}
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function getWeekDates(refDate: Date): Date[] {
  const date = new Date(refDate)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)

  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + index)
    return nextDate
  })
}

function fmtDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isSameDay(left: Date, right: Date) {
  return fmtDate(left) === fmtDate(right)
}

function AddModal({
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
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<Period>('morning')
  const [type, setType] = useState<ItemType>('routine')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSaved({ title, period, type, description, location })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
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
                onClick={() => setPeriod(value)}
                className={`flex-1 py-1.5 rounded-lg text-caption font-medium transition-colors ${period === value ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {PERIOD_LABEL[value]}
              </button>
            ))}
          </div>
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
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="地点（可选）" className="input input-bordered w-full text-body" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述（可选）" className="textarea textarea-bordered w-full text-body" rows={2} />
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary btn-sm w-full">
            {saving ? '保存中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotesModal({
  item,
  onClose,
  onSaved,
}: {
  item: ScheduleItem
  onClose: () => void
  onSaved: (notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(item.meeting_notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSaved(notes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-[var(--color-text-strong)] flex items-center gap-2">
            <FileText size={16} className="text-accent" />会议纪要 · {item.title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="记录会议要点、决议事项、待办跟进..."
          className="textarea textarea-bordered w-full text-body leading-relaxed"
          rows={8}
        />
        <p className="text-caption text-gray-400 mt-1 mb-3">会议纪要将被 AI 分析助手用于提供更精准的业务洞察</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

export function SchedulePage() {
  const today = useMemo(() => new Date(), [])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(fmtDate(today))
  const [showAdd, setShowAdd] = useState(false)
  const [notesItem, setNotesItem] = useState<ScheduleItem | null>(null)

  const refDate = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + weekOffset * 7)
    return date
  }, [today, weekOffset])

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const startDate = fmtDate(weekDates[0])
  const endDate = fmtDate(weekDates[6])
  const { items, loading, addScheduleItem, saveMeetingNotes, deleteScheduleItem } = useScheduleData(startDate, endDate)

  const handleCreate = async (input: {
    title: string
    period: Period
    type: ItemType
    description: string
    location: string
  }) => {
    await addScheduleItem({
      title: input.title,
      date: selectedDate,
      period: input.period,
      type: input.type,
      description: input.description || null,
      location: input.location || null,
    })
  }

  const dayItems = items.filter((item) => item.date === selectedDate)
  const grouped = (['morning', 'afternoon', 'evening'] as Period[])
    .map((period) => ({
      period,
      items: dayItems.filter((item) => item.period === period),
    }))
    .filter((group) => group.items.length > 0)

  const dayCounts = new Map<string, number>()
  items.forEach((item) => dayCounts.set(item.date, (dayCounts.get(item.date) || 0) + 1))

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-table-shell p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} strokeWidth={1.5} className="text-accent" />
              <h3 className="font-medium text-[var(--color-text-strong)]">
                {refDate.getFullYear()}年{refDate.getMonth() + 1}月
              </h3>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setWeekOffset((value) => value - 1)} className="btn btn-ghost btn-xs">‹</button>
              <button onClick={() => { setWeekOffset(0); setSelectedDate(fmtDate(today)) }} className="btn btn-ghost btn-xs text-caption">今天</button>
              <button onClick={() => setWeekOffset((value) => value + 1)} className="btn btn-ghost btn-xs">›</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {weekDates.map((date, index) => {
              const dateString = fmtDate(date)
              const isTodayValue = isSameDay(date, today)
              const isSelected = dateString === selectedDate
              const count = dayCounts.get(dateString) || 0

              return (
                <button
                  key={dateString}
                  onClick={() => setSelectedDate(dateString)}
                  className={`min-w-[48px] py-2 rounded-lg text-center transition-colors flex-shrink-0 relative
                    ${isSelected ? 'bg-accent text-white shadow-card' : isTodayValue ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-primary-50 text-[var(--color-text)] hover:bg-primary-100 border border-[var(--color-border)]'}`}
                >
                  <div className="text-caption opacity-80">{WEEKDAYS[index]}</div>
                  <div className="text-body font-semibold">{date.getDate()}</div>
                  {count > 0 && <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-caption flex items-center justify-center font-medium ${isSelected ? 'bg-white text-accent' : 'bg-accent text-white'}`}>{count}</div>}
                </button>
              )
            })}
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm w-full gap-1.5">
            <Plus size={14} /> 添加日程
          </button>
        </section>

        <section className="app-table-shell p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-[var(--color-text-strong)]">
              {selectedDate} 日程
            </h3>
            <span className="text-caption text-gray-400">{loading ? '加载中...' : `${dayItems.length} 项`}</span>
          </div>

          {dayItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-body">{loading ? '加载中...' : '当日暂无日程'}</p>
              {!loading && <button onClick={() => setShowAdd(true)} className="text-caption text-accent mt-2 hover:underline">点击添加</button>}
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ period, items: periodItems }) => {
                const Icon = PERIOD_ICON[period]
                return (
                  <div key={period}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon size={14} className="text-accent" />
                      <span className="text-caption font-medium text-gray-500">{PERIOD_LABEL[period]}</span>
                    </div>
                    <div className="space-y-2 ml-5">
                      {periodItems.map((item) => (
                        <div key={item.id} className="group flex gap-3 rounded-[18px] border border-[var(--color-border)] bg-white/78 p-3.5 transition-colors hover:bg-primary-50/70">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--color-text-strong)] truncate">{item.title}</span>
                              {item.type && <span className={`text-caption px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[item.type]}`}>{TYPE_LABEL[item.type]}</span>}
                              {item.meeting_notes && <FileText size={12} className="text-accent" />}
                            </div>
                            {(item.description || item.location) && (
                              <div className="text-body text-[var(--color-text-muted)] truncate mt-0.5">
                                {[item.location, item.description].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => setNotesItem(item)} className="p-1.5 hover:bg-accent/10 rounded text-accent" title="会议纪要">
                              <FileText size={14} />
                            </button>
                            <button onClick={() => void deleteScheduleItem(item.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-400" title="删除">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {showAdd && <AddModal date={selectedDate} onClose={() => setShowAdd(false)} onSaved={handleCreate} />}
      {notesItem && (
        <NotesModal
          item={notesItem}
          onClose={() => setNotesItem(null)}
          onSaved={(notes) => saveMeetingNotes(notesItem.id, notes)}
        />
      )}
    </>
  )
}
