import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { Calendar, AlertTriangle } from 'lucide-react'

const reminders = [
  { time: '09:30', title: 'Q2 经营分析会议', desc: '第三会议室 · 全体管理层', urgent: true, tag: '重要' },
  { time: '14:00', title: '新项目洽谈', desc: '广州客户来访 · 商务室 A', urgent: false, tag: '商务' },
  { time: '16:30', title: '月度绩效汇报', desc: '各中心负责人提交报告', urgent: false, tag: '例行' },
]

const warnings = [
  { name: '后勤集团整体', value: 82, status: 'ok' as const },
  { name: '东区项目组', value: 79, status: 'warn' as const },
  { name: '北区餐饮配送', value: 68, status: 'error' as const },
  { name: '数智零售线上', value: 95, status: 'ok' as const },
  { name: '教育集团食堂', value: 88, status: 'ok' as const },
]

const insights = [
  { type: 'positive', title: '数智零售线上业务表现强劲', desc: '线上零售达成率95%，领跑各业务板块，建议复盘爆品运营策略并推广至其他区域' },
  { type: 'alert', title: '北区餐饮配送达成率仅68%，触发红色预警', desc: '需追加 3 个 A 级商机（合同体量≥200万）方可达成全年营收目标。' },
  { type: 'info', title: '建议关注：出差天数与商机转化率相关性分析', desc: '过去3个月拜访频次 ≥ 3 次的客户转化率为42%，远高于平均水平18%' },
]

const barColorMap = {
  ok: 'bg-success',
  warn: 'bg-warning',
  error: 'bg-error',
}

const insightBorderMap = {
  positive: 'border-l-success bg-gray-50',
  alert: 'border-l-error bg-gray-50',
  info: 'border-l-primary-500 bg-gray-50',
}

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <>
      <PageTitle
        breadcrumb="首页 / 总览"
        title="今日总览"
        subtitle={`数据更新：${new Date().toLocaleString('zh-CN')}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="后勤集团总人数"
          value="1,248"
          unit="人"
          trend="↑ 本月新增 12 人"
          trendUp
          onClick={() => navigate(ROUTES.ORG_DATA)}
        />
        <StatCard
          label="本月营收达成率"
          value="82"
          unit="%"
          trend="▲ 较上月 +3.2%"
          trendUp
          color="warning"
          onClick={() => navigate(ROUTES.BIZ_DATA)}
        />
        <StatCard
          label="进行中商机"
          value="27"
          unit="项"
          trend="▲ A 级商机 8 项"
          trendUp
          color="success"
          onClick={() => navigate(ROUTES.OPPORTUNITY)}
        />
        <StatCard
          label="今日出勤率"
          value="94.6"
          unit="%"
          trend="▼ 缺勤 7 人"
          trendUp={false}
          color="error"
          onClick={() => navigate(ROUTES.ATTENDANCE)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">今日日程（3条）</h3>
          </div>
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.time}
                onClick={() => navigate(ROUTES.SCHEDULE)}
                className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-colors
                  ${r.urgent ? 'bg-error-100/50 border-l-2 border-error' : 'bg-gray-50 border-l-2 border-primary-500'}
                  hover:bg-gray-100`}
              >
                <div className="text-gray-600 font-medium text-sm whitespace-nowrap">{r.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{r.title}</div>
                  <div className="text-sm text-gray-600 truncate">{r.desc}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.urgent ? 'bg-error-100 text-error-700' : 'bg-gray-200 text-gray-700'}`}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">经营预警（本月）</h3>
          </div>
          <div className="space-y-4">
            {warnings.map((w) => (
              <div key={w.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{w.name}</span>
                  <span className="font-medium text-gray-900">{w.value}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColorMap[w.status]}`}
                    style={{ width: `${w.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-medium text-gray-900">智能分析 · 今日摘要</h3>
        </div>
        <div className="space-y-3">
          {insights.map((i, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-[3px] ${insightBorderMap[i.type as keyof typeof insightBorderMap]}`}
            >
              <div className="font-medium text-gray-900 mb-1">{i.title}</div>
              <div className="text-sm text-gray-600 leading-relaxed">{i.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
