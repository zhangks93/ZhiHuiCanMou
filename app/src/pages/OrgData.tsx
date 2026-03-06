import { useEffect, useMemo, useState } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { supabase, type FeishuDepartment, type FeishuMember } from '@/lib/supabase'
import { Users, Building2, ChevronRight, ChevronDown, Layers3 } from 'lucide-react'

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
            <span className="truncate text-sm text-gray-800">{node.name}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs">
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

export function OrgData() {
  const [departments, setDepartments] = useState<FeishuDepartment[]>([])
  const [members, setMembers] = useState<FeishuMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('feishu_departments').select('*'),
      supabase.from('feishu_members').select('*'),
    ]).then(([deptRes, memRes]) => {
      setDepartments((deptRes.data ?? []) as FeishuDepartment[])
      setMembers((memRes.data ?? []) as FeishuMember[])
      setLoading(false)
    })
  }, [])

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
  const selectedRatio =
    selectedNode && stats.totalMembers > 0
      ? (selectedNode.totalMembers / stats.totalMembers) * 100
      : 0

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
        <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" />
        <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>
      </>
    )
  }

  if (departments.length === 0) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" />
        <div className="rounded-lg border border-gray-200 bg-surface p-10 text-center">
          <Users size={40} className="mx-auto text-gray-300" />
          <p className="mt-4 text-gray-400">暂无通讯录数据</p>
          <p className="mt-1 text-sm text-gray-400">请先运行同步脚本: python scripts/sync_feishu_contacts.py</p>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" subtitle="数据来源：飞书通讯录" />

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5">
        <div className="flex items-center gap-2 text-sky-700">
          <Layers3 size={16} />
          <p className="text-sm font-medium">组织总览</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
            <p className="text-xs text-gray-500">在册成员</p>
            <p className="mt-1 text-2xl font-semibold text-gray-800 tabular-nums">{stats.totalMembers.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
            <p className="text-xs text-gray-500">部门总数</p>
            <p className="mt-1 text-2xl font-semibold text-gray-800 tabular-nums">{stats.deptCount}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
            <p className="text-xs text-gray-500">活跃部门</p>
            <p className="mt-1 text-2xl font-semibold text-gray-800 tabular-nums">{stats.activeDeptCount}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
            <p className="text-xs text-gray-500">平均每部门</p>
            <p className="mt-1 text-2xl font-semibold text-gray-800 tabular-nums">{stats.averagePerDept.toFixed(1)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          架构根节点 {stats.rootCount} 个
          {stats.largestDept ? ` · 最大部门：${stats.largestDept.name}（${stats.largestDept.totalMembers} 人）` : ''}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">组织架构树</h3>
            </div>
            <div className="flex gap-2 text-xs">
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
            <div className="mb-3 flex items-center justify-end gap-3 text-xs text-gray-500">
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
          <section className="rounded-2xl border border-gray-200 bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">部门详情</h3>
            </div>
            {selectedNode && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-500">当前部门</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">{selectedNode.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedParent ? `上级部门：${selectedParent.name}` : '顶层部门'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-xs text-gray-500">直属</p>
                    <p className="text-base font-semibold text-gray-800 tabular-nums">{selectedNode.member_count}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-xs text-gray-500">总人数</p>
                    <p className="text-base font-semibold text-gray-800 tabular-nums">{selectedNode.totalMembers}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-xs text-gray-500">子部门</p>
                    <p className="text-base font-semibold text-gray-800 tabular-nums">{selectedNode.children.length}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
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

          <section className="rounded-2xl border border-gray-200 bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <Users size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">部门规模排行</h3>
            </div>
            <div className="space-y-2">
              {rankedDepartments.map((dept, index) => (
                <div key={dept.department_id} className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-medium ${
                      index < 3 ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-sm">
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