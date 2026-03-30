import { useEffect, useMemo, useState } from 'react'
import { Users, Building2, ChevronRight, ChevronDown, TrendingUp, TrendingDown, Clock3 } from 'lucide-react'
import { useOrgDirectoryData } from '../hooks/useOrgDirectoryData'
import type { DepartmentMemberChange, FeishuDepartment, FeishuMember } from '../types'

interface DeptNode extends FeishuDepartment {
  children: DeptNode[]
  totalMembers: number
}

function buildTree(depts: FeishuDepartment[], members: FeishuMember[]): DeptNode[] {
  const nodeMap = new Map<string, DeptNode>()
  for (const d of depts) {
    nodeMap.set(d.department_id, { ...d, children: [], totalMembers: 0 })
  }

  const directCount = new Map<string, number>()
  for (const m of members) {
    for (const deptId of m.department_ids ?? []) {
      directCount.set(deptId, (directCount.get(deptId) ?? 0) + 1)
    }
  }

  const roots: DeptNode[] = []
  for (const node of nodeMap.values()) {
    node.member_count = directCount.get(node.department_id) ?? node.member_count
    const parent = node.parent_id ? nodeMap.get(node.parent_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortNodes = (nodes: DeptNode[]) => {
    nodes.sort((a, b) => (a.order_value ?? 0) - (b.order_value ?? 0))
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(roots)

  const calcTotal = (node: DeptNode): number => {
    node.totalMembers = node.member_count + node.children.reduce((sum, child) => sum + calcTotal(child), 0)
    return node.totalMembers
  }
  roots.forEach(calcTotal)

  return roots
}

function flattenTree(nodes: DeptNode[]): DeptNode[] {
  const list: DeptNode[] = []
  const visit = (node: DeptNode) => {
    list.push(node)
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return list
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '暂无'

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSelectedChange(
  changes: DepartmentMemberChange[],
  departmentId: string | null | undefined,
) {
  if (!departmentId) return null
  return changes.find(change => change.department_id === departmentId) ?? null
}

function OrgTreeNode({
  node,
  depth,
  expanded,
  selectedId,
  onSelect,
  onToggle,
}: {
  node: DeptNode
  depth: number
  expanded: Set<string>
  selectedId: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.department_id)
  const isSelected = selectedId === node.department_id

  return (
    <li className="space-y-2">
      <div className="relative" style={{ marginLeft: depth * 16 }}>
        {depth > 0 && <span className="absolute -left-3 top-5 h-px w-3 bg-gray-300" />}
        <div
          className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${
            isSelected ? 'border-accent/30 bg-accent/5' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <button
            type="button"
            className="h-7 w-7 shrink-0 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={!hasChildren}
            onClick={() => hasChildren && onToggle(node.department_id)}
            aria-label={isOpen ? '收起子部门' : '展开子部门'}
          >
            {hasChildren ? (
              isOpen ? <ChevronDown size={14} className="mx-auto" /> : <ChevronRight size={14} className="mx-auto" />
            ) : (
              <span className="block h-3.5" />
            )}
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            onClick={() => onSelect(node.department_id)}
          >
            <span className="truncate text-body text-gray-800">{node.name}</span>
            <span className="flex shrink-0 items-center gap-1 text-caption">
              <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-700 tabular-nums">{node.member_count}</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700 tabular-nums">{node.totalMembers}</span>
            </span>
          </button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <ul className="ml-3 space-y-2 border-l border-dashed border-gray-200 pl-3">
          {node.children.map(child => (
            <OrgTreeNode
              key={child.department_id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OrgDataPage() {
  const { departments, members, snapshotRuns, departmentChanges, loading } = useOrgDirectoryData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState('')

  const tree = useMemo(() => buildTree(departments, members), [departments, members])
  const allNodes = useMemo(() => flattenTree(tree), [tree])
  const nodeMap = useMemo(() => new Map(allNodes.map(node => [node.department_id, node])), [allNodes])
  const departmentMap = useMemo(
    () => new Map(departments.map(dept => [dept.department_id, dept])),
    [departments],
  )

  // Initialize expanded state once when tree is loaded
  useEffect(() => {
    if (tree.length > 0 && expanded.size === 0) {
      setExpanded(new Set(tree.map(node => node.department_id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length])

  // Initialize selectedId when nodes are loaded
  useEffect(() => {
    if (allNodes.length > 0 && !selectedId) {
      setSelectedId(allNodes[0].department_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNodes.length])

  const stats = useMemo(() => {
    const totalMembers = members.length
    const deptCount = departments.length
    const rootCount = tree.length
    const averagePerDept = deptCount > 0 ? totalMembers / deptCount : 0
    const activeDeptCount = allNodes.filter(node => node.member_count > 0).length
    const largestDept = allNodes.reduce<DeptNode | null>((max, node) => {
      if (!max || node.totalMembers > max.totalMembers) return node
      return max
    }, null)
    return { totalMembers, deptCount, rootCount, averagePerDept, activeDeptCount, largestDept }
  }, [allNodes, departments, members, tree.length])

  const selectedNode = selectedId ? nodeMap.get(selectedId) : null
  const selectedParent = selectedNode?.parent_id ? departmentMap.get(selectedNode.parent_id) : null
  const selectedChange = getSelectedChange(departmentChanges, selectedNode?.department_id)
  const selectedRatio =
    selectedNode && stats.totalMembers > 0
      ? (selectedNode.totalMembers / stats.totalMembers) * 100
      : 0

  const latestSnapshot = snapshotRuns[0] ?? null
  const previousSnapshot = snapshotRuns[1] ?? null
  const changedDepartments = departmentChanges.filter(change => change.member_count_change !== 0 || change.change_type !== 'unchanged')
  const netMemberChange = latestSnapshot && previousSnapshot ? latestSnapshot.member_count - previousSnapshot.member_count : 0
  const growthLeaders = [...changedDepartments]
    .filter(change => change.member_count_change > 0)
    .sort((a, b) => b.member_count_change - a.member_count_change)
    .slice(0, 5)
  const shrinkLeaders = [...changedDepartments]
    .filter(change => change.member_count_change < 0)
    .sort((a, b) => a.member_count_change - b.member_count_change)
    .slice(0, 5)

  const rankedDepartments = [...allNodes]
    .filter(node => node.totalMembers > 0)
    .sort((a, b) => b.totalMembers - a.totalMembers)
    .slice(0, 8)
  const maxRankCount = rankedDepartments[0]?.totalMembers ?? 1

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(departments.map(dept => dept.department_id)))
  const collapseAll = () => setExpanded(new Set())

  if (loading) {
    return (
      <>
        <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>
      </>
    )
  }

  if (departments.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-gray-200 bg-surface p-10 text-center">
          <Users size={40} className="mx-auto text-gray-300" />
          <p className="mt-4 text-gray-400">暂无通讯录数据</p>
          <p className="mt-1 text-body text-gray-400">请先运行同步脚本: python scripts/sync_feishu_contacts.py</p>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-white/86 backdrop-blur-xl shadow-[0_24px_64px_rgba(15,23,42,0.10)] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">组织架构树</h3>
            </div>
            <div className="flex gap-2 text-caption">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-md px-2 py-1 text-gray-600 transition-colors hover:bg-gray-200"
              >
                全部展开
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-md px-2 py-1 text-gray-600 transition-colors hover:bg-gray-200"
              >
                全部收起
              </button>
            </div>
          </div>
          <div className="max-h-[620px] overflow-auto p-4">
            <div className="mb-3 flex items-center justify-end gap-3 text-caption text-gray-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-sky-300" />
                直属人数
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-emerald-300" />
                含子部门总人数
              </span>
            </div>
            <ul className="space-y-2">
              {tree.map(root => (
                <OrgTreeNode
                  key={root.department_id}
                  node={root}
                  depth={0}
                  expanded={expanded}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onToggle={toggleExpand}
                />
              ))}
            </ul>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[22px] border border-[var(--color-border)] bg-white/86 backdrop-blur-xl p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
            <div className="flex items-center gap-2">
              <Clock3 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">快照变动</h3>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <p className="text-caption text-gray-500">最近快照</p>
                <p className="mt-1 text-body font-semibold text-gray-800">{latestSnapshot ? latestSnapshot.department_count : '-'}</p>
                <p className="text-caption text-gray-500">部门</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <p className="text-caption text-gray-500">变动部门</p>
                <p className="mt-1 text-body font-semibold text-gray-800">{changedDepartments.length}</p>
                <p className="text-caption text-gray-500">近两次对比</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <p className="text-caption text-gray-500">人数净变化</p>
                <p
                  className={`mt-1 text-body font-semibold tabular-nums ${
                    netMemberChange > 0 ? 'text-emerald-600' : netMemberChange < 0 ? 'text-rose-600' : 'text-gray-800'
                  }`}
                >
                  {previousSnapshot ? `${netMemberChange > 0 ? '+' : ''}${netMemberChange}` : '-'}
                </p>
                <p className="text-caption text-gray-500">总人数</p>
              </div>
            </div>
            <p className="mt-3 text-caption text-gray-500">
              {latestSnapshot ? `最新快照：${formatDateTime(latestSnapshot.snapshot_at)}` : '暂无历史快照'}
              {previousSnapshot ? ` · 上次快照：${formatDateTime(previousSnapshot.snapshot_at)}` : ''}
            </p>

            {changedDepartments.length > 0 && (
              <div className="mt-4 space-y-4">
                {growthLeaders.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-body text-emerald-700">
                      <TrendingUp size={14} />
                      <span>增长最多</span>
                    </div>
                    <div className="space-y-2">
                      {growthLeaders.map(change => (
                        <div key={`up-${change.department_id}`} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                          <span className="truncate pr-3 text-body text-gray-700">{change.department_name}</span>
                          <span className="shrink-0 text-body font-medium tabular-nums text-emerald-700">
                            +{change.member_count_change}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {shrinkLeaders.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-body text-rose-700">
                      <TrendingDown size={14} />
                      <span>减少最多</span>
                    </div>
                    <div className="space-y-2">
                      {shrinkLeaders.map(change => (
                        <div key={`down-${change.department_id}`} className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                          <span className="truncate pr-3 text-body text-gray-700">{change.department_name}</span>
                          <span className="shrink-0 text-body font-medium tabular-nums text-rose-700">
                            {change.member_count_change}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-[22px] border border-[var(--color-border)] bg-white/86 backdrop-blur-xl p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">部门详情</h3>
            </div>
            {selectedNode && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-body text-gray-500">当前部门</p>
                  <p className="mt-1 text-title font-semibold text-gray-800">{selectedNode.name}</p>
                  <p className="text-caption text-gray-500">
                    {selectedParent ? `上级部门：${selectedParent.name}` : '顶层部门'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-caption text-gray-500">直属</p>
                    <p className="text-body font-semibold text-gray-800 tabular-nums">{selectedNode.member_count}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-caption text-gray-500">总人数</p>
                    <p className="text-body font-semibold text-gray-800 tabular-nums">{selectedNode.totalMembers}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-caption text-gray-500">子部门</p>
                    <p className="text-body font-semibold text-gray-800 tabular-nums">{selectedNode.children.length}</p>
                  </div>
                </div>
                {selectedChange && selectedChange.previous_snapshot_at && (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
                    <div className="flex items-center justify-between text-caption text-gray-500">
                      <span>最近两次快照人数变化</span>
                      <span>
                        {formatDateTime(selectedChange.previous_snapshot_at)} → {formatDateTime(selectedChange.latest_snapshot_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-body text-gray-600">
                        {selectedChange.previous_member_count} → {selectedChange.current_member_count}
                      </span>
                      <span
                        className={`text-body font-semibold tabular-nums ${
                          selectedChange.member_count_change > 0
                            ? 'text-emerald-600'
                            : selectedChange.member_count_change < 0
                              ? 'text-rose-600'
                              : 'text-gray-700'
                        }`}
                      >
                        {selectedChange.member_count_change > 0 ? '+' : ''}
                        {selectedChange.member_count_change}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-1 flex items-center justify-between text-caption text-gray-500">
                    <span>占全体成员比例</span>
                    <span className="tabular-nums">{selectedRatio.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${Math.max(selectedRatio, 1)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[22px] border border-[var(--color-border)] bg-white/86 backdrop-blur-xl p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
            <div className="mb-4 flex items-center gap-2">
              <Users size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">部门规模排行</h3>
            </div>
            <div className="space-y-2">
              {rankedDepartments.map((dept, index) => (
                <div key={dept.department_id} className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-caption font-medium ${
                      index < 3 ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-body">
                      <span className="truncate text-gray-700">{dept.name}</span>
                      <span className="ml-2 shrink-0 text-gray-500 tabular-nums">{dept.totalMembers}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-accent/70"
                        style={{ width: `${(dept.totalMembers / maxRankCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
