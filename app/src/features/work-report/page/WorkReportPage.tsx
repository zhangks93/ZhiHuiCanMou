import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, Link2, Trash2, GripVertical, Calendar, Flag, GitBranch } from 'lucide-react'
import { MODULE_NAV_CONFIG, DEFAULT_ENABLED_MODULE_IDS } from '@/config/modules'
import { PageTitle } from '@/components/ui/PageTitle'
import { useWorkReportData } from '../hooks/useWorkReportData'
import type { WorkItemLink } from '../api/workReportRepository'

const MODULE_OPTIONS = DEFAULT_ENABLED_MODULE_IDS.filter(
  (id) => id !== 'work-report' && MODULE_NAV_CONFIG[id],
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

export function WorkReportPage() {
  const { workItems, loading, moveWorkItem, submitWorkItem } = useWorkReportData()
  const [showForm, setShowForm] = useState(false)
  const [formModule, setFormModule] = useState(MODULE_OPTIONS[0] ?? 'schedule')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPriority, setFormPriority] = useState<string>('medium')
  const [formLinks, setFormLinks] = useState<WorkItemLink[]>([])
  const [formLinkUrl, setFormLinkUrl] = useState('')
  const [formLinkTitle, setFormLinkTitle] = useState('')

  const handleDragEnd = async (result: DropResult) => {
    await moveWorkItem(result)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const success = await submitWorkItem({
      moduleId: formModule,
      title: formTitle,
      content: formContent,
      links: formLinks,
      priority: formPriority,
    })

    if (!success) return

    setFormTitle('')
    setFormContent('')
    setFormLinks([])
    setShowForm(false)
  }

  const addLink = () => {
    if (formLinkUrl.trim()) {
      setFormLinks((previous) => [
        ...previous,
        { url: formLinkUrl.trim(), title: formLinkTitle.trim() || undefined },
      ])
      setFormLinkUrl('')
      setFormLinkTitle('')
    }
  }

  const removeLink = (index: number) => {
    setFormLinks((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
  }

  const moduleLabel = (id: string) => MODULE_NAV_CONFIG[id]?.label ?? id
  const projects = [...new Set(workItems.map((item) => item.module_id))].filter(Boolean)
  if (projects.length === 0) projects.push(...MODULE_OPTIONS)

  return (
    <div className="app-page">
      <PageTitle
        title="项目协同"
        subtitle="任务收集、状态拖拽和项目分组统一进入新的科技感工作流界面，让操作层级、控件和信息密度都与导航系统保持一致。"
        badge="Workflow"
        icon={GitBranch}
      />

      <div className="app-toolbar">
        <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <GitBranch size={16} />
          按项目分组、按状态流转，协同推进任务
        </p>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm gap-2">
          <Plus size={16} />
          新建任务
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 mb-6 shadow-[0_24px_64px_rgba(15,23,42,0.10)]"
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
                {Object.entries(PRIORITY_CONFIG).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
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
                  {formLinks.map((link, index) => (
                    <li key={`${link.url}-${index}`} className="flex items-center gap-2 text-sm">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-accent truncate flex-1"
                      >
                        {link.title || link.url}
                      </a>
                      <button type="button" onClick={() => removeLink(index)} className="text-error hover:underline">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">创建</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">取消</button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] shadow-[0_24px_64px_rgba(15,23,42,0.10)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary-400">加载中...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="border-b border-primary-200 bg-primary-50/50">
                    <th className="w-40 px-4 py-3 text-left text-sm font-medium text-primary-500">项目</th>
                    {STATUSES.map((status) => (
                      <th key={status.id} className="min-w-[200px] px-3 py-3 text-center text-sm font-medium text-primary-500">
                        {status.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((projectId) => (
                    <tr key={projectId} className="border-b border-primary-100">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-primary sticky left-0">{moduleLabel(projectId)}</div>
                      </td>
                      {STATUSES.map((status) => {
                        const droppableId = `project-${projectId}-${status.id}`
                        const items = workItems.filter((item) => item.module_id === projectId && item.status === status.id)
                        return (
                          <td key={droppableId} className="align-top p-2">
                            <Droppable droppableId={droppableId} direction="vertical">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[120px] rounded-lg px-3 py-2 transition-colors ${
                                    snapshot.isDraggingOver ? 'bg-accent/10 ring-2 ring-accent/30' : ''
                                  } ${status.color}`}
                                >
                                  {items.length === 0 && !snapshot.isDraggingOver && (
                                    <div className="text-xs text-primary-400/70 py-4 text-center">拖拽卡片到此处</div>
                                  )}
                                  {items.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(dragProvided, dragSnapshot) => (
                                        <div
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          className={`mb-2 rounded-lg border border-primary-200 bg-surface p-3 shadow-card hover:shadow-card-hover transition-shadow ${
                                            dragSnapshot.isDragging ? 'opacity-90 shadow-lg' : ''
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            <div
                                              {...dragProvided.dragHandleProps}
                                              className="mt-0.5 cursor-grab text-primary-300 hover:text-primary"
                                            >
                                              <GripVertical size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`badge badge-sm ${PRIORITY_CONFIG[item.priority]?.class ?? 'badge-ghost'}`}>
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
    </div>
  )
}
