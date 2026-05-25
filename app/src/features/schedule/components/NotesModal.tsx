import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { AppButton } from '@/shared/ui/AppButton'
import type { ScheduleItem } from '../api/scheduleRepository'

export function NotesModal({
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
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
          <AppButton onClick={onClose} variant="ghost" size="sm">取消</AppButton>
          <AppButton onClick={handleSave} disabled={saving} variant="primary" size="sm">{saving ? '保存中...' : '保存'}</AppButton>
        </div>
      </div>
    </div>
  )
}
