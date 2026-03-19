import { useMemo, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wrench,
  XCircle,
} from 'lucide-react'

import type { ToolCallRecord } from '@/lib/agent'

function ToolStatusIcon({ status }: { status: ToolCallRecord['status'] }) {
  if (status === 'calling') return <Loader2 size={14} className="animate-spin text-info" />
  if (status === 'success') return <CheckCircle2 size={14} className="text-success" />
  return <XCircle size={14} className="text-error" />
}

function ToolCallItem({ toolCall }: { toolCall: ToolCallRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="chat-process-item">
      <button
        type="button"
        className="chat-process-item-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chat-process-item-meta">
          <ToolStatusIcon status={toolCall.status} />
          <Wrench size={14} />
          <span className="font-mono text-[12px]">{toolCall.name}</span>
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="chat-process-item-body">
          <div>
            <div className="chat-process-label">参数</div>
            <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
          </div>
          {toolCall.result && (
            <div>
              <div className="chat-process-label">结果</div>
              <pre>{toolCall.result}</pre>
            </div>
          )}
          {toolCall.error && <div className="text-error text-xs">{toolCall.error}</div>}
        </div>
      )}
    </div>
  )
}

export function ChatProcessPanel({
  thinking,
  toolCalls,
}: {
  thinking?: string
  toolCalls?: ToolCallRecord[]
}) {
  const [open, setOpen] = useState(false)

  const summary = useMemo(() => {
    const parts: string[] = []
    if (toolCalls?.length) parts.push(`已调用 ${toolCalls.length} 个工具`)
    if (thinking?.trim()) parts.push('包含思考过程')
    return parts.join(' · ') || '查看过程信息'
  }, [thinking, toolCalls])

  if (!thinking?.trim() && !toolCalls?.length) {
    return null
  }

  return (
    <section className="chat-process-panel">
      <button
        type="button"
        className="chat-process-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chat-process-summary">
          <BrainCircuit size={14} />
          <span>过程信息</span>
          <span className="chat-process-summary-text">{summary}</span>
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="chat-process-content">
          {thinking?.trim() && (
            <div className="chat-process-block">
              <div className="chat-process-label">思考过程</div>
              <div className="chat-process-thinking">{thinking}</div>
            </div>
          )}
          {toolCalls?.length ? (
            <div className="chat-process-block">
              <div className="chat-process-label">工具调用</div>
              <div className="chat-process-list">
                {toolCalls.map((toolCall) => <ToolCallItem key={toolCall.id} toolCall={toolCall} />)}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
