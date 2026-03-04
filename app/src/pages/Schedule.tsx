import { useState, useEffect, useCallback } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { supabase } from '@/lib/supabase'
import { Calendar, Plus, Trash2, FileText, X, Sun, Sunset, Moon } from 'lucide-react'

type Period = 'morning' | 'afternoon' | 'evening'
type ItemType = 'meeting' | 'business' | 'routine' | 'urgent'

interface ScheduleItem {
  id: string
  title: string
  description: string | null
  date: string
  period: Period
  type: ItemType | null
  location: string | null
  meeting_notes: string | null
  created_at: string
}

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
  const d = new Date(refDate)
  const day = d.getDay() || 7 // Mon=1..Sun=7
  d.setDate(d.getDate() - day + 1)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(d)
    dt.setDate(d.getDate() + i)
    return dt
  })
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date) {
  return fmtDate(a) === fmtDate(b)
}

// --- Add Schedule Modal ---
function AddModal({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<Period>('morning')
  const [type, setType] = useState<ItemType>('routine')
  const [desc, setDesc] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('schedule_items').insert({ title: title.trim(), description: desc || null, date, period, type, location: location || null })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[var(--color-text-strong)]">添加日程 · {date}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="日程标题" className="input input-bordered w-full text-sm" />
          <div className="flex gap-2">
            {(['morning', 'afternoon', 'evening'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['meeting', 'business', 'routine', 'urgent'] as ItemType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${type === t ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="地点（可选）" className="input input-bordered w-full text-sm" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="描述（可选）" className="textarea textarea-bordered w-full text-sm" rows={2} />
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary btn-sm w-full">
            {saving ? '保存中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Meeting Notes Modal ---
function NotesModal({ item, onClose, onSaved }: { item: ScheduleItem; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(item.meeting_notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('schedule_items').update({ meeting_notes: notes || null }).eq('id', item.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-[var(--color-text-strong)] flex items-center gap-2">
            <FileText size={16} className="text-accent" />会议纪要 · {item.title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="记录会议要点、决议事项、待办跟进..."
          className="textarea textarea-bordered w-full text-sm leading-relaxed" rows={8} />
        <p className="text-xs text-gray-400 mt-1 mb-3">会议纪要将被 AI 分析助手用于提供更精准的业务洞察</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---
export function Schedule() {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(fmtDate(today))
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [notesItem, setNotesItem] = useState<ScheduleItem | null>(null)

  const refDate = new Date(today)
  refDate.setDate(refDate.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(refDate)

  const fetchItems = useCallback(async () => {
    const start = fmtDate(weekDates[0])
    const end = fmtDate(weekDates[6])
    const { data } = await supabase
      .from('schedule_items')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .order('period')
    setItems((data as ScheduleItem[]) || [])
  }, [weekOffset])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (id: string) => {
    await supabase.from('schedule_items').delete().eq('id', id)
    fetchItems()
  }

  const dayItems = items.filter(i => i.date === selectedDate)
  const grouped = (['morning', 'afternoon', 'evening'] as Period[]).map(p => ({
    period: p,
    items: dayItems.filter(i => i.period === p),
  })).filter(g => g.items.length > 0)

  // Count items per day for dot indicators
  const dayCounts = new Map<string, number>()
  items.forEach(i => dayCounts.set(i.date, (dayCounts.get(i.date) || 0) + 1))

  return (
    <>
      <PageTitle breadcrumb="首页 / 日程提醒" title="日程提醒" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar */}
        <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} strokeWidth={1.5} className="text-accent" />
              <h3 className="font-medium text-[var(--color-text-strong)] font-serif">
                {refDate.getFullYear()}年{refDate.getMonth() + 1}月
              </h3>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setWeekOffset(o => o - 1)} className="btn btn-ghost btn-xs">‹</button>
              <button onClick={() => { setWeekOffset(0); setSelectedDate(fmtDate(today)) }} className="btn btn-ghost btn-xs text-xs">今天</button>
              <button onClick={() => setWeekOffset(o => o + 1)} className="btn btn-ghost btn-xs">›</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {weekDates.map((d, i) => {
              const ds = fmtDate(d)
              const isToday = isSameDay(d, today)
              const isSelected = ds === selectedDate
              const count = dayCounts.get(ds) || 0
              return (
                <button key={i} onClick={() => setSelectedDate(ds)}
                  className={`min-w-[48px] py-2 rounded-lg text-center transition-colors flex-shrink-0 relative
                    ${isSelected ? 'bg-accent text-white shadow-card' : isToday ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-primary-50 text-[var(--color-text)] hover:bg-primary-100 border border-[var(--color-border)]'}`}>
                  <div className="text-xs opacity-80">{WEEKDAYS[i]}</div>
                  <div className="text-base font-semibold">{d.getDate()}</div>
                  {count > 0 && <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-medium ${isSelected ? 'bg-white text-accent' : 'bg-accent text-white'}`}>{count}</div>}
                </button>
              )
            })}
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm w-full gap-1.5">
            <Plus size={14} /> 添加日程
          </button>
        </div>

        {/* Right: Day detail */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">
              {selectedDate} 日程
            </h3>
            <span className="text-xs text-gray-400">{dayItems.length} 项</span>
          </div>

          {dayItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">当日暂无日程</p>
              <button onClick={() => setShowAdd(true)} className="text-xs text-accent mt-2 hover:underline">点击添加</button>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ period, items: pItems }) => {
                const Icon = PERIOD_ICON[period]
                return (
                  <div key={period}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className="text-accent" />
                      <span className="text-xs font-medium text-gray-500">{PERIOD_LABEL[period]}</span>
                    </div>
                    <div className="space-y-2 ml-5">
                      {pItems.map(item => (
                        <div key={item.id} className="group flex gap-3 p-3 rounded-lg bg-primary-50/80 border-l-[3px] border-accent hover:bg-primary-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--color-text-strong)] truncate">{item.title}</span>
                              {item.type && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[item.type]}`}>{TYPE_LABEL[item.type]}</span>}
                              {item.meeting_notes && <FileText size={12} className="text-accent" />}
                            </div>
                            {(item.description || item.location) && (
                              <div className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
                                {[item.location, item.description].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => setNotesItem(item)} className="p-1.5 hover:bg-accent/10 rounded text-accent" title="会议纪要">
                              <FileText size={14} />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-400" title="删除">
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
        </div>
      </div>

      {showAdd && <AddModal date={selectedDate} onClose={() => setShowAdd(false)} onSaved={fetchItems} />}
      {notesItem && <NotesModal item={notesItem} onClose={() => setNotesItem(null)} onSaved={fetchItems} />}
    </>
  )
}
