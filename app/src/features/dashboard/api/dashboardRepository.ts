import { supabase } from '@/shared/lib/supabase'

export async function fetchDashboardSnapshot(today: string) {
  const [bizRes, scheduleRes, warningRes, opportunityRes, membersRes] = await Promise.all([
    supabase
      .from('edu_logistics_biz_data')
      .select('revenue_completion_rate,profit_completion_rate,yoy_revenue,created_at')
      .is('center', null)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('schedule_items')
      .select('id,title,period,type,description,location,created_at')
      .eq('date', today)
      .order('period'),
    supabase
      .from('edu_logistics_biz_data')
      .select('node_name,revenue_completion_rate')
      .not('center', 'is', null)
      .is('biz_class', null)
      .not('revenue_completion_rate', 'is', null),
    supabase
      .from('opportunity_ledger')
      .select('snapshot_date,schema_version,stage_code,first_year_revenue,updated_at')
      .order('snapshot_date', { ascending: false })
      .limit(500),
    supabase.from('feishu_members').select('user_id'),
  ])

  return {
    bizRes,
    scheduleRes,
    warningRes,
    opportunityRes,
    membersRes,
  }
}
