import { useEffect, useState, useMemo } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { supabase, type FeishuDepartment, type FeishuMember } from '@/lib/supabase'
import { Users, Building2, UserCheck, ChevronRight, ChevronDown } from 'lucide-react'

// 部门树节点
interface DeptNode extends FeishuDepartment {
  children: DeptNode[]
  totalMembers: number // 含子部门的递归人数
}

// 构建部门树
function buildTree(depts: FeishuDepartment[], members: FeishuMember[]): DeptNode[] {
  const nodeMap = new Map<string, DeptNode>()
  for (const d of depts) {
    nodeMap.set(d.department_id, { ...d, children: [], totalMembers: 0 })
  }

  // 统计每个部门的直属人数
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
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // 按 order_value 排序
  const sortChildren = (nodes: DeptNode[]) => {
    nodes.sort((a, b) => (a.order_value ?? 0) - (b.order_value ?? 0))
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  // 递归计算总人数
  const calcTotal = (node: DeptNode): number => {
    node.totalMembers = node.member_count + node.children.reduce((s, c) => s + calcTotal(c), 0)
    return node.totalMembers
  }
  roots.forEach(calcTotal)

  return roots
}

// 员工类型映射
const EMP_TYPE_LABEL: Record<number, string> = {
  1: '正式',
  2: '实习',
  3: '外包',
  4: '劳务',
  5: '顾问',
}

// 部门树行组件
function DeptRow({ node, depth, expanded, onToggle }: {
  node: DeptNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.department_id)
  const pct = node.totalMembers > 0
    ? ((node.member_count / node.totalMembers) * 100).toFixed(1)
    : '—'

  return (
    <>
      <tr
        className={`border-t border-gray-100 hover:bg-gray-50/60 transition-colors ${depth === 0 ? 'bg-gray-50/40 font-medium' : ''}`}
        onClick={() => hasChildren && onToggle(node.department_id)}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
      >
        <td className="py-2.5 px-4 text-gray-700">
          <span style={{ paddingLeft: depth * 20 }} className="inline-flex items-center gap-1">
            {hasChildren ? (
              isOpen
                ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                : <ChevronRight size={14} className="text-gray-400 shrink-0" />
            ) : (
              <span className="w-3.5" />
            )}
            {node.name}
          </span>
        </td>
        <td className="py-2.5 px-4 text-right text-gray-700 tabular-nums">{node.member_count}</td>
        <td className="py-2.5 px-4 text-right text-gray-700 tabular-nums">{node.totalMembers}</td>
        <td className="py-2.5 px-4 text-right">
          {depth > 0 && pct !== '—' && (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {pct}%
            </span>
          )}
        </td>
      </tr>
      {isOpen && node.children.map(child => (
        <DeptRow key={child.department_id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  )
}

export function OrgData() {
  const [departments, setDepartments] = useState<FeishuDepartment[]>([])
  const [members, setMembers] = useState<FeishuMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  // 默认展开第一层
  useEffect(() => {
    if (tree.length > 0 && expanded.size === 0) {
      setExpanded(new Set(tree.map(n => n.department_id)))
    }
  }, [tree])

  // 统计数据
  const stats = useMemo(() => {
    const total = members.length
    const typeCount = new Map<number, number>()
    let genderM = 0, genderF = 0
    for (const m of members) {
      if (m.employee_type) typeCount.set(m.employee_type, (typeCount.get(m.employee_type) ?? 0) + 1)
      if (m.gender === 1) genderM++
      if (m.gender === 2) genderF++
    }
    const formal = typeCount.get(1) ?? 0
    return { total, formal, genderM, genderF, typeCount, deptCount: departments.length }
  }, [members, departments])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    setExpanded(new Set(departments.map(d => d.department_id)))
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  if (loading) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" />
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      </>
    )
  }

  if (departments.length === 0) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" />
        <div className="bg-surface rounded-lg border border-gray-200 p-10 text-center">
          <Users size={40} className="mx-auto text-gray-300" />
          <p className="text-gray-400 mt-4">暂无通讯录数据</p>
          <p className="text-gray-400 text-sm mt-1">请先运行同步脚本: python scripts/sync_feishu_contacts.py</p>
        </div>
      </>
    )
  }

  // 员工类型分布
  const typeEntries = Array.from(stats.typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ label: EMP_TYPE_LABEL[type] ?? `类型${type}`, count }))

  return (
    <>
      <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" subtitle={`数据来源：飞书通讯录`} />

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="总人数" value={stats.total.toLocaleString()} color="default" />
        <StatCard label="部门数" value={stats.deptCount} color="default" />
        <StatCard
          label="正式员工"
          value={stats.formal.toLocaleString()}
          trend={`占比 ${stats.total ? ((stats.formal / stats.total) * 100).toFixed(1) : 0}%`}
          trendUp
          color="success"
        />
        <StatCard
          label="性别比例"
          value={`${stats.genderM} : ${stats.genderF}`}
          trend={`男 ${stats.total ? ((stats.genderM / stats.total) * 100).toFixed(0) : 0}% · 女 ${stats.total ? ((stats.genderF / stats.total) * 100).toFixed(0) : 0}%`}
          trendUp
          color="default"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 部门架构树 */}
        <div className="lg:col-span-2 bg-surface rounded-lg border border-gray-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-500" />
              <h3 className="font-medium text-gray-700">组织架构</h3>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={expandAll} className="px-2 py-1 rounded hover:bg-gray-200 text-gray-500 transition-colors">全部展开</button>
              <button onClick={collapseAll} className="px-2 py-1 rounded hover:bg-gray-200 text-gray-500 transition-colors">全部收起</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">部门</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600 w-24">直属人数</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600 w-24">总人数</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600 w-20">占比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tree.map(root => (
                  <DeptRow key={root.department_id} node={root} depth={0} expanded={expanded} onToggle={toggleExpand} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧统计面板 */}
        <div className="space-y-6">
          {/* 员工类型分布 */}
          <div className="bg-surface rounded-lg border border-gray-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck size={16} className="text-gray-500" />
              <h3 className="font-medium text-gray-700">员工类型分布</h3>
            </div>
            <div className="space-y-3">
              {typeEntries.map(({ label, count }) => {
                const pct = stats.total ? (count / stats.total) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="text-gray-700 font-medium tabular-nums">{count} 人</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 各部门人数 Top */}
          <div className="bg-surface rounded-lg border border-gray-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-gray-500" />
              <h3 className="font-medium text-gray-700">部门人数排行</h3>
            </div>
            <div className="space-y-2">
              {[...departments]
                .sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))
                .filter(d => (d.member_count ?? 0) > 0)
                .slice(0, 10)
                .map((d, i) => {
                  const count = d.member_count ?? 0
                  const maxCount = departments.reduce((m, dd) => Math.max(m, dd.member_count ?? 0), 1)
                  return (
                    <div key={d.department_id} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded text-xs flex items-center justify-center font-medium shrink-0 ${i < 3 ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="text-gray-700 truncate">{d.name}</span>
                          <span className="text-gray-500 tabular-nums shrink-0 ml-2">{count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-accent/60 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
