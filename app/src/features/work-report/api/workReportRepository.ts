import { supabase } from '@/lib/supabase'

export interface WorkItemLink {
  url: string
  title?: string
}

export interface WorkItem {
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

function mapStatus(status: string): string {
  const mapping: Record<string, string> = {
    draft: 'todo',
    submitted: 'in_progress',
    approved: 'done',
  }

  return mapping[status] ?? status
}

export function normalizeWorkItems(raw: unknown[]): WorkItem[] {
  return raw.map((item) => {
    const row = item as Record<string, unknown>
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

export async function fetchCurrentUserWorkItems() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('work_items')
    .select('*')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })

  return normalizeWorkItems(data ?? [])
}

export async function updateWorkItemPlacement(params: {
  workItemId: string
  moduleId: string
  status: string
}) {
  return supabase
    .from('work_items')
    .update({
      module_id: params.moduleId,
      status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.workItemId)
}

export async function createWorkItem(input: {
  moduleId: string
  title: string
  content: string
  links: WorkItemLink[]
  priority: string
  periodStart: string
  periodEnd: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.org_id ?? '00000000-0000-0000-0000-000000000001'

  return supabase.from('work_items').insert({
    org_id: orgId,
    module_id: input.moduleId,
    reporter_id: user.id,
    title: input.title || input.content?.slice(0, 80) || '未命名',
    content: input.content || null,
    links: input.links,
    status: 'todo',
    priority: input.priority,
    period_start: input.periodStart,
    period_end: input.periodEnd,
  })
}
