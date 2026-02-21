import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { PageTitle } from '@/components/ui/PageTitle'
import {
  Plus,
  Link2,
  Trash2,
  GripVertical,
  Calendar,
  Flag,
  GitBranch,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MODULE_NAV_CONFIG, DEFAULT_ENABLED_MODULE_IDS } from '@/config/modules'

interface WorkItemLink {
  url: string
  title?: string
}

interface WorkItem {
  id: string
  module_id: string
  title: string | null
  content: string | null
  links: WorkItemLink[]
  status: string
  priority: string
  period_start: string | null
  period_end: string | null
  created_at: string
  reporter_id: string
}

const MODULE_OPTIONS = DEFAULT_ENABLED_MODULE_IDS.filter(
  (id) => id !== 'work-report' && MODULE_NAV_CONFIG[id]
)

const STATUSES = [
  { id: 'todo', label: '待处理', color: 'bg-base-300' },
  { id: 'in_progress', label: '进行中', color: 'bg-accent/20' },
  { id: 'in_review', label: '待审核', color: 'bg-warning/20' },
  { id: 'done', label: '已完成', color: 'bg-success/20' },
] as const

const PRIORITY_CONFIG: Record<string, { label: string; class: string }> = {
  low: { label: '低', class: 'badge-ghost' },
  medium: { label: '中', class: 'badge-info badge-outline' },
  high: { label: '高', class: 'badge-warning' },
  urgent: { label: '紧急', class: 'badge-error' },
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

function parseDroppableId(id: string): { moduleId: string; status: string } {
  const [, moduleId, status] = id.split('-')
  return { moduleId: moduleId ?? '', status: status ?? 'todo' }
}

export function WorkReport() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formModule, setFormModule] = useState(MODULE_OPTIONS[0] ?? 'schedule')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPriority, setFormPriority] = useState<string>('medium')
  const [formLinks, setFormLinks] = useState<WorkItemLink[]>([])
  const [formLinkUrl, setFormLinkUrl] = useState('')
  const [formLinkTitle, setFormLinkTitle] = useState('')

  const fetchItems = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return []
    const { data } = await supabase
      .from('work_items')
      .select('*')
      .eq('reporter_id', u.id)
      .order('created_at', { ascending: false })
    return normalizeItems(data ?? [])
  }, [])

  function normalizeItems(raw: unknown[]): WorkItem[] {
    return raw.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        module_id: String(row.module_id),
        title: (row.title as string) ?? (row.content ? String(row.content).slice(0, 80) : null) ?? '未命名',
        content: (row.content as string) ?? null,
        links: (Array.isArray(row.links) ? row.links : []) as WorkItemLink[],
        status: mapStatus(String(row.status ?? 'todo')),
        priority: String(row.priority ?? 'medium'),
        period_start: (row.period_start as string) ?? null,
        period_end: (row.period_end as string) ?? null,
        created_at: String(row.created_at ?? ''),
        reporter_id: String(row.reporter_id ?? ''),
      }
    })
  }

  function mapStatus(s: string): string {
    const m: Record<string, string> = {
      draft: 'todo',
      submitted: 'in_progress',
      approved: 'done',
    }
    return m[s] ?? (STATUSES.some((st) => st.id === s) ? s : 'todo')
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchItems()
      .then((items) => {
        if (!cancelled) setWorkItems(items)
      })
      .catch((e) => {
        if (!cancelled) console.warn('[WorkReport] Fetch failed:', e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [fetchItems])

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const { draggableId, destination } = result
      const { moduleId, status } = parseDroppableId(destination.droppableId)

      const item = workItems.find((i) => i.id === draggableId)
      if (!item || (item.module_id === moduleId && item.status === status)) return

      setWorkItems((prev) =>
        prev.map((i) =>
          i.id === draggableId ? { ...i, module_id: moduleId, status } : i
        )
      )

      const { error } = await supabase
        .from('work_items')
        .update({ module_id: moduleId, status, updated_at: new Date().toISOString() })
        .eq('id', draggableId)

      if (error) {
        console.error('[WorkReport] Update failed:', error)
        fetchItems().then(setWorkItems)
      }
    },
    [workItems, fetchItems]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', u.id)
      .single()
    const orgId = profile?.org_id ?? '00000000-0000-0000-0000-000000000001'
    const { start, end } = getWeekRange()

    const { error } = await supabase.from('work_items').insert({
      org_id: orgId,
      module_id: formModule,
      reporter_id: u.id,
      title: formTitle || formContent?.slice(0, 80) || '未命名',
      content: formContent || null,
      links: formLinks,
      status: 'todo',
      priority: formPriority,
      period_start: start,
      period_end: end,
    })

    if (error) {
      console.error('[WorkReport] Insert failed:', error)
      return
    }
    setFormTitle('')
    setFormContent('')
    setFormLinks([])
    setShowForm(false)
    fetchItems().then(setWorkItems)
  }

  const addLink = () => {
    if (formLinkUrl.trim()) {
      setFormLinks((prev) => [
        ...prev,
        { url: formLinkUrl.trim(), title: formLinkTitle.trim() || undefined },
      ])
      setFormLinkUrl('')
      setFormLinkTitle('')
    }
  }

  const removeLink = (i: number) => {
    setFormLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  const moduleLabel = (id: string) => MODULE_NAV_CONFIG[id]?.label ?? id

  // Group by project (module_id), then by status
  const projects = [...new Set(workItems.map((i) => i.module_id))].filter(Boolean)
  if (projects.length === 0) projects.push(...MODULE_OPTIONS)

  return (
    <>
      <PageTitle
        breadcrumb="工作台 / 项目协同"
        title="项目协同看板"
        subtitle="多项目任务管理，拖拽卡片同步进展，团队协作一目了然"
      />

      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-primary-400 flex items-center gap-2">
          <GitBranch size={16} />
          按项目分组、按状态流转，协同推进任务
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary btn-sm gap-2"
        >
          <Plus size={16} />
          新建任务
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-xl border border-primary-200 p-5 mb-6 shadow-card"
        >
          <h3 className="font-medium text-primary mb-4 flex items-center gap-2">
            <GitBranch size={18} />
            新建任务卡片
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-400 mb-1">关联项目</label>
              <select
                value={formModule}
                onChange={(e) => setFormModule(e.target.value)}
                className="select select-bordered select-sm w-full max-w-xs"
              >
                {MODULE_OPTIONS.map((id) => (
                  <option key={id} value={id}>
                    {moduleLabel(id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-400 mb-1">标题</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="简要标题"
                className="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-400 mb-1 flex items-center gap-2">
                <Flag size={14} />
                优先级
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="select select-bordered select-sm w-full max-w-xs"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-400 mb-1">进展说明</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="详细描述..."
                className="textarea textarea-bordered textarea-sm w-full min-h-[80px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-400 mb-1 flex items-center gap-1.5">
                <Link2 size={14} />
                飞书链接
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={formLinkUrl}
                  onChange={(e) => setFormLinkUrl(e.target.value)}
                  placeholder="https://xxx.feishu.cn/..."
                  className="input input-bordered input-sm flex-1"
                />
                <input
                  type="text"
                  value={formLinkTitle}
                  onChange={(e) => setFormLinkTitle(e.target.value)}
                  placeholder="标题"
                  className="input input-bordered input-sm w-32"
                />
                <button type="button" onClick={addLink} className="btn btn-ghost btn-sm">
                  添加
                </button>
              </div>
              {formLinks.length > 0 && (
                <ul className="space-y-1">
                  {formLinks.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-accent truncate flex-1"
                      >
                        {l.title || l.url}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
                        className="text-error hover:underline"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                创建
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-surface rounded-xl border border-primary-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary-400">加载中...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="border-b border-primary-200 bg-primary-50/50">
                    <th className="w-40 px-4 py-3 text-left text-sm font-medium text-primary-500">
                      项目
                    </th>
                    {STATUSES.map((s) => (
                      <th
                        key={s.id}
                        className="min-w-[200px] px-3 py-3 text-center text-sm font-medium text-primary-500"
                      >
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((projectId) => (
                    <tr key={projectId} className="border-b border-primary-100">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-primary sticky left-0">
                          {moduleLabel(projectId)}
                        </div>
                      </td>
                      {STATUSES.map((status) => {
                        const droppableId = `project-${projectId}-${status.id}`
                        const items = workItems.filter(
                          (i) => i.module_id === projectId && i.status === status.id
                        )
                        return (
                          <td key={droppableId} className="align-top p-2">
                            <Droppable droppableId={droppableId} direction="vertical">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[120px] rounded-lg px-3 py-2 transition-colors ${
                                    snapshot.isDraggingOver ? 'bg-accent/10 ring-2 ring-accent/30' : ''
                                  } ${STATUSES.find((s) => s.id === status.id)?.color ?? 'bg-base-200/50'}`}
                                >
                                  {items.length === 0 && !snapshot.isDraggingOver && (
                                    <div className="text-xs text-primary-400/70 py-4 text-center">
                                      拖拽卡片到此处
                                    </div>
                                  )}
                                  {items.map((item, idx) => (
                                    <Draggable
                                      key={item.id}
                                      draggableId={item.id}
                                      index={idx}
                                    >
                                      {(prov, snap) => (
                                        <div
                                          ref={prov.innerRef}
                                          {...prov.draggableProps}
                                          className={`mb-2 rounded-lg border border-primary-200 bg-surface p-3 shadow-card hover:shadow-card-hover transition-shadow ${
                                            snap.isDragging ? 'opacity-90 shadow-lg' : ''
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            <div
                                              {...prov.dragHandleProps}
                                              className="mt-0.5 cursor-grab text-primary-300 hover:text-primary"
                                            >
                                              <GripVertical size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span
                                                  className={`badge badge-sm ${
                                                    PRIORITY_CONFIG[item.priority]?.class ?? 'badge-ghost'
                                                  }`}
                                                >
                                                  {PRIORITY_CONFIG[item.priority]?.label ?? '中'}
                                                </span>
                                              </div>
                                              <div className="font-medium text-primary text-sm truncate" title={item.title || item.content || '未命名'}>
                                                {item.title || item.content?.slice(0, 60) || '未命名'}
                                              </div>
                                              {item.content && item.content !== item.title && (
                                                <p className="text-xs text-primary-400 mt-0.5 truncate" title={item.content}>
                                                  {item.content}
                                                </p>
                                              )}
                                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {item.period_start && (
                                                  <span className="flex items-center gap-0.5 text-xs text-primary-400">
                                                    <Calendar size={12} />
                                                    {item.period_start} ~ {item.period_end}
                                                  </span>
                                                )}
                                                {Array.isArray(item.links) && item.links.length > 0 && (
                                                  <span className="flex items-center gap-0.5 text-xs text-accent">
                                                    <Link2 size={12} />
                                                    {item.links.length}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DragDropContext>
        )}
      </div>

      {!loading && workItems.length === 0 && (
        <div className="mt-4 p-6 text-center text-primary-400 rounded-xl border border-primary-200 bg-primary-50/30">
          暂无任务，点击「新建任务」开始项目协同
        </div>
      )}
    </>
  )
}
