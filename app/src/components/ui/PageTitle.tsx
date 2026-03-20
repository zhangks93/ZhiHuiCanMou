import { useLocation } from 'react-router-dom'

interface PageTitleProps {
  breadcrumb?: string
  title?: string
  subtitle?: string
}

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: '首页', subtitle: '运营总览与重点提醒' },
  '/work-report': { title: '项目协同', subtitle: '按项目推进任务与看板协同' },
  '/schedule': { title: '日程提醒', subtitle: '查看当天安排与后续提醒' },
  '/org-data': { title: '常用数据', subtitle: '组织与人员基础信息' },
  '/biz-data': { title: '经营数据', subtitle: '经营分析与结构化对比' },
  '/opportunity': { title: '商机台账', subtitle: '跟踪项目机会与阶段进展' },
  '/competitor': { title: '竞对档案', subtitle: '沉淀竞品和竞争对手信息' },
  '/trip': { title: '出差管理', subtitle: '查看出差记录与在途状态' },
  '/attendance': { title: '考勤管理', subtitle: '部门出勤情况与成员明细' },
  '/links': { title: '系统链接', subtitle: '常用系统入口与外部链接' },
  '/ai': { title: 'AI 分析', subtitle: '智能问答、报告与分析' },
  '/settings': { title: '设置', subtitle: '系统参数与模块配置' },
  '/login': { title: '登录' },
}

function looksBroken(value?: string) {
  if (!value) return true
  return /[锟介弮閸熸＃]/.test(value)
}

export function PageTitle({ title, subtitle }: PageTitleProps) {
  const location = useLocation()
  const routeMeta = PAGE_META[location.pathname]

  const heading = !looksBroken(title) ? title : routeMeta?.title ?? '首页'
  const description = !looksBroken(subtitle) ? subtitle : routeMeta?.subtitle

  return (
    <div className="relative mb-6 animate-slide-up">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold text-[var(--color-text-strong)] sm:text-[2rem]">
          {heading}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
