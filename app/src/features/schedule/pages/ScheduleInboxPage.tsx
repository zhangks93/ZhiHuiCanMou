import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox, Download, Ban, CheckCircle2 } from 'lucide-react'
import { importScheduleTransferPayload, type ScheduleImportResult } from '../api/scheduleRepository'
import {
  cancelScheduleTransfer,
  listIncomingScheduleTransfers,
  listOutgoingScheduleTransfers,
  markScheduleTransferImported,
  type ScheduleTransferRecord,
} from '../api/scheduleTransferRepository'

type InboxTab = 'incoming' | 'outgoing'

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatImportSummary(result: ScheduleImportResult | null) {
  if (!result) return '尚未导入'
  return `新增 ${result.inserted_count} 条，覆盖 ${result.overwritten_count} 条`
}

export function ScheduleInboxPage() {
  const [activeTab, setActiveTab] = useState<InboxTab>('incoming')
  const [incoming, setIncoming] = useState<ScheduleTransferRecord[]>([])
  const [outgoing, setOutgoing] = useState<ScheduleTransferRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [nextIncoming, nextOutgoing] = await Promise.all([
        listIncomingScheduleTransfers(),
        listOutgoingScheduleTransfers(),
      ])
      setIncoming(nextIncoming)
      setOutgoing(nextOutgoing)
      setError(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '收件箱加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleImport = useCallback(async (record: ScheduleTransferRecord) => {
    setBusyTransferId(record.id)
    try {
      const result = await importScheduleTransferPayload(record.payload)
      await markScheduleTransferImported(record.id, result)
      await reload()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '共享日程导入失败，请稍后重试。')
    } finally {
      setBusyTransferId(null)
    }
  }, [reload])

  const handleCancel = useCallback(async (record: ScheduleTransferRecord) => {
    setBusyTransferId(record.id)
    try {
      await cancelScheduleTransfer(record.id)
      await reload()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '分享取消失败，请稍后重试。')
    } finally {
      setBusyTransferId(null)
    }
  }, [reload])

  const currentList = useMemo(
    () => (activeTab === 'incoming' ? incoming : outgoing),
    [activeTab, incoming, outgoing],
  )

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="app-table-shell p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-[var(--color-text-strong)]">日程收件箱</h3>
            <p className="mt-1 text-body text-[var(--color-text-muted)]">
              接收同事发送的日程包，并导入到当前设备本地。
            </p>
          </div>
          <div className="flex gap-2 rounded-2xl bg-primary-50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('incoming')}
              className={`rounded-2xl px-4 py-2 text-body font-medium transition-colors ${activeTab === 'incoming' ? 'bg-white text-[var(--color-text-strong)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
            >
              收件箱
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outgoing')}
              className={`rounded-2xl px-4 py-2 text-body font-medium transition-colors ${activeTab === 'outgoing' ? 'bg-white text-[var(--color-text-strong)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
            >
              发件箱
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
          {error}
        </section>
      ) : null}

      <section className="app-table-shell p-5">
        {loading ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">加载中...</div>
        ) : currentList.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <Inbox size={28} className="mx-auto mb-3 opacity-50" />
            {activeTab === 'incoming' ? '暂无待处理日程包' : '暂无发出的日程包'}
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map((record) => {
              const isIncoming = activeTab === 'incoming'
              const isBusy = busyTransferId === record.id
              const statusLabel =
                record.status === 'imported' ? '已导入' : record.status === 'cancelled' ? '已取消' : '待处理'

              return (
                <article
                  key={record.id}
                  className="rounded-[20px] border border-[var(--color-border)] bg-white/86 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--color-text-strong)]">
                          {isIncoming ? `${record.senderName} 发来 ${record.payload.items.length} 条日程` : `发送给 ${record.recipientName}`}
                        </span>
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-caption text-[var(--color-text-muted)]">
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 text-body text-[var(--color-text-muted)]">
                        创建时间：{formatDateTime(record.createdAt)}
                      </div>
                      <div className="mt-1 text-body text-[var(--color-text-muted)]">
                        覆盖策略：同日期同时间段自动覆盖，会议纪要保留本地
                      </div>
                      <div className="mt-1 text-body text-[var(--color-text-muted)]">
                        导入结果：{formatImportSummary(record.importedSummary)}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isIncoming && record.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleImport(record)}
                          className="btn btn-primary btn-sm gap-1.5"
                        >
                          <Download size={14} />
                          {isBusy ? '导入中...' : '导入到本地'}
                        </button>
                      ) : null}

                      {!isIncoming && record.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleCancel(record)}
                          className="btn btn-ghost btn-sm gap-1.5 border border-[var(--color-border)]"
                        >
                          <Ban size={14} />
                          {isBusy ? '处理中...' : '取消发送'}
                        </button>
                      ) : null}

                      {record.status === 'imported' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-caption font-medium text-emerald-700">
                          <CheckCircle2 size={14} />
                          已完成
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {record.payload.items.slice(0, 4).map((item) => (
                      <div
                        key={`${record.id}-${item.source_item_id}`}
                        className="rounded-2xl bg-primary-50/70 px-3 py-2 text-body text-[var(--color-text-muted)]"
                      >
                        <div className="font-medium text-[var(--color-text-strong)]">{item.title}</div>
                        <div className="mt-1">{item.date} · {item.start_time ? formatDateTime(item.start_time) : '无时间'}</div>
                      </div>
                    ))}
                    {record.payload.items.length > 4 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-2 text-body text-[var(--color-text-muted)]">
                        其余 {record.payload.items.length - 4} 条将在导入时一并处理
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
