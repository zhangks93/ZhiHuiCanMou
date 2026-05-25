import { useMemo, useState } from 'react'
import { Calendar, Plus, Trash2, FileText, Upload, Send } from 'lucide-react'
import { useAuth } from '@/app/hooks/useAuth'
import { getCurrentAuthUser } from '../api/scheduleRepository'
import { createScheduleTransfer } from '../api/scheduleTransferRepository'
import type { ItemType, Period, ScheduleItem } from '../api/scheduleRepository'
import { AddEventModal } from '../components/AddEventModal'
import { NotesModal } from '../components/NotesModal'
import { ShareModal } from '../components/ShareModal'
import { useScheduleData } from '../hooks/useScheduleData'
import { useScheduleImport } from '../hooks/useScheduleImport'
import { PERIOD_ICON, PERIOD_LABEL, TYPE_COLOR, TYPE_LABEL, WEEKDAYS } from '../lib/scheduleLabels'
import { fmtDate, formatTimeRange, getWeekDates, isSameDay } from '../lib/scheduleTimeHelpers'
import { AppButton } from '@/shared/ui/AppButton'
import { AppIconButton } from '@/shared/ui/AppIconButton'
import { ConfirmAction } from '@/shared/ui/ConfirmAction'

export function SchedulePage() {
  const { user } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(fmtDate(today))
  const [showAdd, setShowAdd] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [notesItem, setNotesItem] = useState<ScheduleItem | null>(null)
  const [shareResult, setShareResult] = useState<string | null>(null)

  const refDate = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + weekOffset * 7)
    return date
  }, [today, weekOffset])

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const startDate = fmtDate(weekDates[0])
  const endDate = fmtDate(weekDates[6])
  const {
    items,
    loading,
    error,
    addScheduleItem,
    saveMeetingNotes,
    deleteScheduleItem,
    importScheduleWorkbook,
    buildTransferPayload,
  } = useScheduleData(startDate, endDate)

  const {
    fileInputRef,
    importing,
    importResult,
    importError,
    handleImportClick,
    handleImportFile,
  } = useScheduleImport(importScheduleWorkbook)

  const handleCreate = async (input: {
    title: string
    period: Period
    type: ItemType
    description: string
    location: string
    startTime: string | null
    endTime: string | null
  }) => {
    await addScheduleItem({
      title: input.title,
      date: selectedDate,
      period: input.period,
      start_time: input.startTime,
      end_time: input.endTime,
      type: input.type,
      description: input.description || null,
      location: input.location || null,
    })
  }

  const dayItems = items.filter((item) => item.date === selectedDate)
  const grouped = (['morning', 'afternoon', 'evening'] as const)
    .map((period) => ({
      period,
      items: dayItems.filter((item) => item.period === period),
    }))
    .filter((group) => group.items.length > 0)

  const dayCounts = new Map<string, number>()
  items.forEach((item) => dayCounts.set(item.date, (dayCounts.get(item.date) || 0) + 1))

  const handleShareSubmit = async (input: { recipientUserId: string; selectedItemIds: string[] }) => {
    const { userId } = await getCurrentAuthUser()
    const payload = await buildTransferPayload(input.selectedItemIds, userId, user?.name ?? '未命名用户')
    await createScheduleTransfer({
      recipientUserId: input.recipientUserId,
      payload,
    })
    setShareResult(`已发送 ${payload.items.length} 条日程，接收方可在收件箱导入。`)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-table-shell p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Calendar size={18} strokeWidth={1.5} className="text-accent" />
              <h3 className="font-medium text-[var(--color-text-strong)]">
                {refDate.getFullYear()}年{refDate.getMonth() + 1}月
              </h3>
            </div>
            <div className="flex w-full gap-1 sm:w-auto">
              <AppButton onClick={() => setWeekOffset((value) => value - 1)} variant="ghost" size="sm">‹</AppButton>
              <AppButton onClick={() => { setWeekOffset(0); setSelectedDate(fmtDate(today)) }} variant="ghost" size="sm">今天</AppButton>
              <AppButton onClick={() => setWeekOffset((value) => value + 1)} variant="ghost" size="sm">›</AppButton>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const dateString = fmtDate(date)
              const isTodayValue = isSameDay(date, today)
              const isSelected = dateString === selectedDate
              const count = dayCounts.get(dateString) || 0

              return (
                <button
                  key={dateString}
                  onClick={() => setSelectedDate(dateString)}
                  className={`relative min-w-0 rounded-xl px-1 py-2 text-center transition-colors
                    ${isSelected ? 'bg-accent text-white shadow-card' : isTodayValue ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-primary-50 text-[var(--color-text)] hover:bg-primary-100 border border-[var(--color-border)]'}`}
                >
                  <div className="text-[11px] opacity-80 sm:text-caption">{WEEKDAYS[index]}</div>
                  <div className="text-body font-semibold leading-5">{date.getDate()}</div>
                  {count > 0 && <div className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium sm:text-caption ${isSelected ? 'bg-white text-accent' : 'bg-accent text-white'}`}>{count}</div>}
                </button>
              )
            })}
          </div>
          <AppButton onClick={() => setShowAdd(true)} variant="primary" size="sm" className="w-full">
            <Plus size={14} /> 添加日程
          </AppButton>
          <AppButton
            onClick={() => {
              setShareResult(null)
              setShowShare(true)
            }}
            disabled={items.length === 0}
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
          >
            <Send size={14} /> 发送给同事
          </AppButton>
          <AppButton onClick={handleImportClick} disabled={importing} variant="secondary" size="sm" className="mt-2 w-full">
            <Upload size={14} /> {importing ? '导入中...' : '导入飞书日程'}
          </AppButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => void handleImportFile(event)}
          />
        </section>

        <section className="app-table-shell p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-[var(--color-text-strong)]">
              {selectedDate} 日程
            </h3>
            <span className="text-caption text-gray-400">{loading ? '加载中...' : `${dayItems.length} 项`}</span>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
              {error}
            </div>
          ) : null}

          {importResult ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-body text-emerald-800">
              已导入 {importResult.inserted_count} 条，覆盖 {importResult.overwritten_count} 条。
            </div>
          ) : null}

          {importError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
              {importError}
            </div>
          ) : null}

          {shareResult ? (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-body text-sky-800">
              {shareResult}
            </div>
          ) : null}

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
                            {([formatTimeRange(item), item.location, item.description].filter(Boolean).length > 0) && (
                              <div className="text-body text-[var(--color-text-muted)] truncate mt-0.5">
                                {[formatTimeRange(item), item.location, item.description].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <AppIconButton label="会议纪要" size="sm" variant="secondary" onClick={() => setNotesItem(item)}>
                              <FileText size={14} />
                            </AppIconButton>
                            <ConfirmAction
                              message={`确认删除「${item.title}」？`}
                              onConfirm={() => void deleteScheduleItem(item.id)}
                            >
                              {(confirm) => (
                                <AppIconButton label="删除日程" size="sm" variant="danger" onClick={confirm}>
                                  <Trash2 size={14} />
                                </AppIconButton>
                              )}
                            </ConfirmAction>
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

      {showAdd && <AddEventModal date={selectedDate} onClose={() => setShowAdd(false)} onSaved={handleCreate} />}
      {showShare ? (
        <ShareModal
          items={items}
          senderName={user?.name ?? '未命名用户'}
          onClose={() => setShowShare(false)}
          onSubmit={handleShareSubmit}
        />
      ) : null}
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
