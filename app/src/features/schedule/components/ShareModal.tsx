import { useEffect, useState } from 'react'
import { Send, X } from 'lucide-react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { AppButton } from '@/shared/ui/AppButton'
import { listScheduleTransferRecipients, type ScheduleTransferRecipient } from '../api/scheduleTransferRepository'
import type { ScheduleItem } from '../api/scheduleRepository'
import { PERIOD_LABEL } from '../lib/scheduleLabels'
import { formatTimeRange } from '../lib/scheduleTimeHelpers'

export function ShareModal({
  items,
  senderName,
  onClose,
  onSubmit,
}: {
  items: ScheduleItem[]
  senderName: string
  onClose: () => void
  onSubmit: (input: { recipientUserId: string; selectedItemIds: string[] }) => Promise<void>
}) {
  const [recipients, setRecipients] = useState<ScheduleTransferRecipient[]>([])
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => items.map((item) => item.id))
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const nextRecipients = await listScheduleTransferRecipients()
        if (!cancelled) {
          setRecipients(nextRecipients)
          setSelectedRecipientId(nextRecipients[0]?.userId ?? '')
          setLoadingRecipients(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError, '接收人加载失败，请稍后重试。'))
          setLoadingRecipients(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    )
  }

  const handleSubmit = async () => {
    if (!selectedRecipientId || selectedItemIds.length === 0) return

    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        recipientUserId: selectedRecipientId,
        selectedItemIds,
      })
      onClose()
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '日程发送失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-[var(--color-text-strong)]">发送给同事</h3>
            <p className="mt-1 text-body text-[var(--color-text-muted)]">发送人：{senderName}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-body text-[var(--color-text-muted)]">接收人</span>
            <select
              value={selectedRecipientId}
              disabled={loadingRecipients || recipients.length === 0}
              onChange={(event) => setSelectedRecipientId(event.target.value)}
              className="select select-bordered w-full text-body"
            >
              {recipients.length === 0 ? (
                <option value="">{loadingRecipients ? '加载中...' : '暂无可发送对象'}</option>
              ) : null}
              {recipients.map((recipient) => (
                <option key={recipient.userId} value={recipient.userId}>
                  {recipient.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-body text-[var(--color-text-muted)]">发送内容</span>
              <button
                type="button"
                onClick={() => setSelectedItemIds(items.map((item) => item.id))}
                className="text-caption text-accent hover:underline"
              >
                全选
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-3 hover:bg-primary-50/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="checkbox checkbox-sm mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--color-text-strong)]">{item.title}</div>
                    <div className="mt-1 text-body text-[var(--color-text-muted)]">
                      {item.date} · {formatTimeRange(item) || PERIOD_LABEL[item.period]} {item.location ? `· ${item.location}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-primary-50/70 px-4 py-3 text-body text-[var(--color-text-muted)]">
            导入策略：接收方点击导入后，同日期同时间段的日程会自动覆盖；会议纪要保留接收方本地内容。
          </div>

          {error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <AppButton onClick={onClose} variant="ghost" size="sm">取消</AppButton>
            <AppButton
              onClick={() => void handleSubmit()}
              disabled={saving || !selectedRecipientId || selectedItemIds.length === 0}
              variant="primary"
              size="sm"
            >
              <Send size={14} />
              {saving ? '发送中...' : `发送 ${selectedItemIds.length} 条`}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  )
}
