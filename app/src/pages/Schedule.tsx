import { useState } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Calendar } from 'lucide-react'

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const dayNums = [16, 17, 18, 19, 20, 21, 22]
const today = 18

const todayReminders = [
  { time: '09:30', title: 'Q2 经营分析会议', desc: '第三会议室 · 全体管理层', tag: '今日' },
  { time: '14:00', title: '新项目客户洽谈', desc: '广州客户来访', tag: '今日' },
  { time: '明 10:00', title: '区域经理月度汇报', desc: '视频会议', tag: '明日' },
]

const memos = [
  { deadline: '截止 06/20', title: '半年度预算复盘提交', desc: '各中心负责人汇报' },
  { deadline: '截止 06/25', title: 'Q3 商机储备计划上报', desc: '市场部' },
  { deadline: '截止 06/30', title: '年度竞对档案更新', desc: '战略部' },
]

export function Schedule() {
  const [selectedDay, setSelectedDay] = useState(today)

  return (
    <>
      <PageTitle breadcrumb="首页 / 日程提醒" title="日程提醒" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} strokeWidth={1.5} className="text-accent" />
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">本周日历</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {weekDays.map((wd, i) => (
              <button
                key={i}
                onClick={() => setSelectedDay(dayNums[i])}
                className={`min-w-[48px] py-2 rounded-lg text-center transition-colors flex-shrink-0
                  ${selectedDay === dayNums[i]
                    ? 'bg-accent text-white shadow-card'
                    : 'bg-primary-50 text-[var(--color-text)] hover:bg-primary-100 border border-[var(--color-border)]'
                  }`}
              >
                <div className="text-xs opacity-80">{wd}</div>
                <div className="text-base font-semibold">{dayNums[i]}</div>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {todayReminders.map((r) => (
              <div
                key={r.time}
                className={`flex gap-3 p-3 rounded-lg transition-colors border-l-[3px]
                  ${r.tag === '今日' && r.time.startsWith('09') ? 'bg-error-100/30 border-error' : 'bg-primary-50/80 border-accent'}
                `}
              >
                <div className="text-[var(--color-text-muted)] font-medium text-sm whitespace-nowrap">{r.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--color-text-strong)] truncate">{r.title}</div>
                  <div className="text-sm text-[var(--color-text-muted)] truncate">{r.desc}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${r.tag === '今日' ? 'bg-error-100 text-error-700' : 'bg-accent-100 text-accent-700'}`}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} strokeWidth={1.5} className="text-accent" />
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">重要备忘</h3>
          </div>
          <div className="space-y-2">
            {memos.map((m) => (
              <div
                key={m.deadline}
                className="flex gap-3 p-3 rounded-lg bg-primary-50/80 border-l-[3px] border-accent hover:bg-primary-50 transition-colors"
              >
                <div className="text-[var(--color-text-muted)] font-medium text-sm whitespace-nowrap">{m.deadline}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--color-text-strong)] truncate">{m.title}</div>
                  <div className="text-sm text-[var(--color-text-muted)] truncate">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
