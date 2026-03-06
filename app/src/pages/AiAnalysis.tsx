import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageTitle } from '@/components/ui/PageTitle'
import { Send, Bot, User, Sparkles, Wrench, ChevronDown, ChevronRight, Loader2, Settings, AlertTriangle, CheckCircle2, Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeftOpen, Brain, X } from 'lucide-react'
import { loadLLMConfig } from '@/lib/llmConfig'
import { runAgent } from '@/lib/agent/agent'
import { generateSuggestedQuestions } from '@/lib/agent/suggestions'
import { loadSessions, saveSession, loadSessionMessages, deleteSession as deleteSessionStorage, loadMemories, deleteMemory } from '@/lib/agent/memory'
import type { ChatMessage, AgentStep, ChatSession, AgentMemory } from '@/lib/agent/types'

let msgId = Date.now()
const nextId = () => String(++msgId)

const TOOL_NAME_MAP: Record<string, string> = {
  query_biz_data: '查询经营数据',
  query_org_data: '查询组织数据',
  analyze_biz_org_insights: '经营组织联合洞察',
  query_opportunities: '查询商机台账',
  query_work_items: '查询工作汇报',
  query_schedules: '查询日程纪要',
  query_attendance: '查询考勤记录',
  query_trips: '查询出差记录',
  web_search: '联网搜索',
  save_memory: '保存记忆',
  recall_memory: '检索记忆',
}

function ToolCallGroup({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false)
  const call = steps.find(s => s.type === 'tool_call')
  const result = steps.find(s => s.type === 'tool_result')

  if (!call) return null

  const isDone = !!result
  const displayName = TOOL_NAME_MAP[call.toolName ?? ''] ?? call.toolName

  let formattedResult = ''
  let hasError = false
  if (result) {
    try {
      const parsed = JSON.parse(result.content)
      if (parsed.error) {
        hasError = true
        formattedResult = `错误: ${parsed.error}`
      } else {
        formattedResult = JSON.stringify(parsed, null, 2)
      }
    } catch {
      formattedResult = result.content
    }
  }

  return (
    <div className="my-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded-md px-2 py-1 -ml-2 transition-colors w-full text-left"
      >
        {isDone
          ? hasError
            ? <AlertTriangle size={14} className="text-warning shrink-0" />
            : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          : <Loader2 size={14} className="animate-spin text-accent shrink-0" />}
        <Wrench size={12} className="text-primary/60 shrink-0" />
        <span className="font-medium text-gray-700">{displayName}</span>
        {call.toolArgs && Object.keys(call.toolArgs).length > 0 && (
          <span className="flex gap-1 flex-wrap">
            {Object.entries(call.toolArgs).slice(0, 3).map(([k, v]) => (
              <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono">
                {k}={typeof v === 'string' ? (v.length > 20 ? v.slice(0, 20) + '...' : v) : JSON.stringify(v)}
              </span>
            ))}
            {Object.keys(call.toolArgs).length > 3 && (
              <span className="text-gray-400 text-[10px]">+{Object.keys(call.toolArgs).length - 3}</span>
            )}
          </span>
        )}
        <span className="ml-auto shrink-0">{open ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}</span>
      </button>
      {open && result && (
        <div className={`ml-6 mt-1 mb-2 max-h-48 overflow-y-auto rounded-lg border p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed ${hasError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          {formattedResult.slice(0, 2000)}{formattedResult.length > 2000 ? '\n...(结果过长，已截断)' : ''}
        </div>
      )}
    </div>
  )
}

function StepItem({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)

  if (step.type === 'thinking') {
    const lines = step.content.split('\n').filter(l => l.trim())
    const isLong = lines.length > 3 || step.content.length > 150
    const preview = isLong
      ? lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n...' : '')
      : step.content

    return (
      <div className="my-1 rounded-lg bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/10 px-3 py-2">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
              {expanded ? step.content : preview}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-accent hover:text-accent/80 mt-1 transition-colors font-medium"
              >
                {expanded ? '收起' : '展开全部'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step.type === 'reasoning') {
    const lines = step.content.split('\n').filter(l => l.trim())
    const isLong = lines.length > 3 || step.content.length > 150
    const preview = isLong
      ? lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n...' : '')
      : step.content

    return (
      <div className="my-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
        <div className="flex items-start gap-2">
          <Brain size={14} className="mt-0.5 shrink-0 text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">
              {expanded ? step.content : preview}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-blue-500 hover:text-blue-600 mt-1 transition-colors font-medium"
              >
                {expanded ? '收起' : '展开全部'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step.type === 'error') {
    return (
      <div className="my-1 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-700 leading-relaxed">{step.content}</p>
        </div>
      </div>
    )
  }

  return null
}

function getStepDotColor(group: AgentStep[]): string {
  const first = group[0]
  if (!first) return 'bg-gray-300'

  if (first.type === 'error') return 'bg-red-400'

  if (first.type === 'tool_call') {
    const result = group.find(s => s.type === 'tool_result')
    if (!result) return 'bg-primary animate-pulse' // Still loading

    // Check if result contains error
    try {
      const parsed = JSON.parse(result.content)
      if (parsed.error) return 'bg-warning'
    } catch {
      // Not JSON or no error field
    }
    return 'bg-emerald-400'
  }

  if (first.type === 'thinking') return 'bg-accent'
  if (first.type === 'reasoning') return 'bg-blue-400'

  return 'bg-gray-300'
}

function getLoadingText(steps: AgentStep[]): string {
  if (!steps.length) return '分析中...'
  const lastToolCall = [...steps].reverse().find(s => s.type === 'tool_call')
  if (lastToolCall?.toolName) {
    const name = TOOL_NAME_MAP[lastToolCall.toolName] ?? lastToolCall.toolName
    return `正在${name}...`
  }
  const lastStep = steps[steps.length - 1]
  if (lastStep.type === 'thinking') return '正在思考...'
  return '分析中...'
}

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === 'user'
  const steps = msg.steps ?? []

  // Handle clear_stream: if present, remove answer_delta steps before it
  const clearStreamIdx = steps.findIndex(s => s.type === 'clear_stream')
  const filteredSteps = clearStreamIdx >= 0
    ? steps.filter((s, i) => {
        // Remove answer_delta before clear_stream, and remove clear_stream itself
        if (s.type === 'clear_stream') return false
        if (s.type === 'answer_delta' && i < clearStreamIdx) return false
        return true
      })
    : steps

  // Group steps: pair tool_call with its tool_result using toolCallId
  const groupedSteps: AgentStep[][] = []
  const toolCallMap = new Map<string, AgentStep[]>()

  for (const step of filteredSteps) {
    if (step.type === 'tool_call' && step.toolCallId) {
      // Create a new group for this tool call
      const group = [step]
      toolCallMap.set(step.toolCallId, group)
      groupedSteps.push(group)
    } else if (step.type === 'tool_result' && step.toolCallId) {
      // Find the matching tool_call group and add result to it
      const group = toolCallMap.get(step.toolCallId)
      if (group) {
        group.push(step)
      } else {
        // Orphaned tool_result, create standalone group
        groupedSteps.push([step])
      }
    } else if (step.type !== 'answer_delta' && step.type !== 'answer') {
      // Other steps (thinking, reasoning, error) get their own group
      groupedSteps.push([step])
    }
  }

  // Collect streamed answer_delta content
  const streamedAnswer = steps
    .filter(s => s.type === 'answer_delta')
    .map(s => s.content)
    .join('')

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-slide-up`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary text-white' : 'bg-accent/10 text-accent'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        {isUser ? (
          <div className="inline-block rounded-2xl rounded-tr-sm bg-primary text-white px-4 py-2.5 text-sm">
            {msg.content}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-surface border border-gray-200 px-4 py-3 shadow-card">
            {groupedSteps.length > 0 && (
              <div className="relative ml-1 mb-3">
                {/* Timeline left border - only show if there are multiple steps */}
                {groupedSteps.length > 1 && (
                  <div className="absolute left-[5px] top-3 bottom-1 w-px bg-gray-200" />
                )}
                {groupedSteps.map((group, i) => (
                  <div key={i} className="relative pl-6 pb-1 last:pb-0">
                    {/* Dot node */}
                    <div className={`absolute left-0 top-2 w-[11px] h-[11px] rounded-full border-2 border-white shadow-sm ${getStepDotColor(group)}`} />
                    {group[0]?.type === 'tool_call'
                      ? <ToolCallGroup steps={group} />
                      : group.map((step, j) => <StepItem key={j} step={step} />)}
                  </div>
                ))}
              </div>
            )}
            {isStreaming && !msg.steps?.some(s => s.type === 'answer') && !streamedAnswer && (
              <div className="flex items-center gap-2 text-xs text-gray-400 my-2 ml-1">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span>{getLoadingText(msg.steps ?? [])}</span>
              </div>
            )}
            {(msg.content || streamedAnswer) && (
              <div className={`text-sm text-gray-800 leading-relaxed prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-2 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-th:text-gray-700 prose-td:px-3 prose-td:py-1.5 prose-td:text-xs prose-strong:text-gray-900 prose-code:text-accent prose-code:bg-gray-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none ${groupedSteps.length > 0 ? 'mt-2' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || streamedAnswer}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  insight: '洞察', conclusion: '结论', anomaly: '异常', trend: '趋势',
}

function MemoryModal({ onClose }: { onClose: () => void }) {
  const [memories, setMemories] = useState<AgentMemory[]>(loadMemories)
  const handleDelete = (id: string) => {
    deleteMemory(id)
    setMemories(loadMemories())
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-medium flex items-center gap-2"><Brain size={16} className="text-accent" />记忆管理</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {memories.length === 0 && <p className="text-sm text-gray-400 text-center py-8">暂无记忆条目</p>}
          {memories.map(m => (
            <div key={m.id} className="border rounded-lg p-3 text-xs group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-gray-700 leading-relaxed flex-1">{m.content}</p>
                <button onClick={() => handleDelete(m.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 shrink-0"><Trash2 size={12} /></button>
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">{CATEGORY_LABELS[m.category] || m.category}</span>
                {m.keywords.map(k => <span key={k} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{k}</span>)}
                <span className="text-gray-300 ml-auto">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AiAnalysis() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const s = loadSessions()
    return s.length > 0 ? s[0].id : null
  })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const s = loadSessions()
    return s.length > 0 ? loadSessionMessages(s[0].id) : []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const config = loadLLMConfig()

  useEffect(() => { generateSuggestedQuestions(8).then(setSuggestions).catch(() => {}) }, [])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Persist messages whenever they change (skip empty)
  useEffect(() => {
    if (!activeSessionId || messages.length === 0) return
    const session = sessions.find(s => s.id === activeSessionId)
    if (session) {
      const updated = { ...session, updatedAt: Date.now() }
      saveSession(updated, messages)
    }
  }, [messages, activeSessionId, sessions])

  const createSession = useCallback(() => {
    const id = crypto.randomUUID()
    const session: ChatSession = { id, title: '新对话', createdAt: Date.now(), updatedAt: Date.now() }
    saveSession(session, [])
    setSessions(loadSessions())
    setActiveSessionId(id)
    setMessages([])
  }, [])

  const switchSession = useCallback((id: string) => {
    abortControllerRef.current?.abort()
    setActiveSessionId(id)
    setMessages(loadSessionMessages(id))
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSessionStorage(id)
    const remaining = loadSessions()
    setSessions(remaining)
    if (activeSessionId === id) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id)
        setMessages(loadSessionMessages(remaining[0].id))
      } else {
        setActiveSessionId(null)
        setMessages([])
      }
    }
  }, [activeSessionId])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || !config) return

    // Abort any pending request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    // Auto-create session if none active
    let sid = activeSessionId
    if (!sid) {
      sid = crypto.randomUUID()
      const session: ChatSession = { id: sid, title: text.trim().slice(0, 30), createdAt: Date.now(), updatedAt: Date.now() }
      saveSession(session, [])
      setSessions(loadSessions())
      setActiveSessionId(sid)
    }

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text.trim(), timestamp: Date.now() }
    const assistantMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '', steps: [], timestamp: Date.now() }

    // Update title from first user message
    const isFirst = messages.length === 0
    if (isFirst) {
      const s = sessions.find(s => s.id === sid)
      if (s && s.title === '新对话') {
        const updated = { ...s, title: text.trim().slice(0, 30), updatedAt: Date.now() }
        saveSession(updated, [...messages, userMsg, assistantMsg])
        setSessions(loadSessions())
      }
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    const history = messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const answer = await runAgent(text.trim(), config, history, (step) => {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'assistant'
            ? { ...m, steps: [...(m.steps ?? []), step] }
            : m
        ))
        scrollToBottom()
      }, sid, abortControllerRef.current.signal)

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'assistant'
          ? { ...m, content: answer }
          : m
      ))

      // Auto-generate title after first response
      if (isFirst) {
        try {
          const { callLLMSimple } = await import('@/lib/agent/llm')
          const title = await callLLMSimple(config, `用5个字以内总结这个问题的主题，只返回标题，不要其他内容：${text.trim()}`, abortControllerRef.current.signal)
          if (title && title.trim()) {
            const s = sessions.find(s => s.id === sid)
            if (s) {
              const updated = { ...s, title: title.trim().slice(0, 30), updatedAt: Date.now() }
              setSessions(prev => prev.map(ss => ss.id === sid ? updated : ss))
              saveSession(updated, messages)
            }
          }
        } catch {
          // Silently fail title generation
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setMessages(prev => prev.slice(0, -1))
        return
      }
      const errMsg = e instanceof Error ? e.message : String(e)
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'assistant'
          ? { ...m, steps: [...(m.steps ?? []), { type: 'error' as const, content: errMsg }], content: `分析出错：${errMsg}` }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [loading, config, messages, scrollToBottom, activeSessionId, sessions])

  // No LLM config
  if (!config) {
    return (
      <>
        <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle size={40} className="text-warning mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">尚未配置 AI 模型</h3>
          <p className="text-sm text-gray-500 mb-4">请先在设置页面配置 LLM 提供商和 API Key</p>
          <a href="#/settings" className="btn btn-primary btn-sm gap-1.5">
            <Settings size={14} /> 前往设置
          </a>
        </div>
      </>
    )
  }

  const isEmpty = messages.length === 0

  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" subtitle="AI 自主数据分析助手" />

      <div className="flex rounded-lg border border-gray-200 shadow-card overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        {/* Session sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-2 border-b border-gray-200 flex items-center gap-1">
              <button onClick={createSession} className="btn btn-ghost btn-xs flex-1 gap-1 justify-start text-xs">
                <Plus size={14} /> 新对话
              </button>
              <button onClick={() => setMemoryOpen(true)} className="btn btn-ghost btn-xs gap-1 text-xs" title="记忆管理">
                <Brain size={14} />
              </button>
              <button onClick={() => setSidebarOpen(false)} className="btn btn-ghost btn-xs">
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${s.id === activeSessionId ? 'bg-accent/10 text-accent' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => switchSession(s.id)}
                >
                  <MessageSquare size={12} className="shrink-0" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-4">暂无对话</p>
              )}
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col bg-surface min-w-0">
          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="absolute top-2 left-2 z-10 btn btn-ghost btn-xs">
                <PanelLeftOpen size={14} />
              </button>
            )}
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <Bot size={28} className="text-accent" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-1">智汇参谋 · AI 分析助手</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-md">
                  我能自主理解你的业务问题，从数据库获取经营数据、组织通讯录、商机台账、工作汇报等信息，为你提供深度分析洞察。
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-accent hover:text-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isStreaming={loading && msg === messages[messages.length - 1]} />
              ))
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="输入你的业务问题，如：各中心利润达成情况如何？"
                className="input input-bordered flex-1 text-sm"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="btn btn-primary btn-square"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Agent 会自主规划分析步骤并查询数据库 · 支持跨会话记忆
            </p>
          </div>
        </div>
      </div>

      {memoryOpen && <MemoryModal onClose={() => setMemoryOpen(false)} />}
    </>
  )
}
