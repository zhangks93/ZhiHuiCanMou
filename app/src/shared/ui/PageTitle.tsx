import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface PageTitleProps {
  breadcrumb?: string
  title?: string
  subtitle?: string
  badge?: string
  icon?: LucideIcon
  meta?: Array<{
    label: string
    value: string
  }>
  actions?: ReactNode
}

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: '首页', subtitle: '工作台模块入口' },
  '/schedule': { title: '日程提醒', subtitle: '查看当天安排与后续提醒' },
  '/org-data': { title: '人员', subtitle: '组织与人员基础信息' },
  '/biz-data': { title: '经营', subtitle: '经营分析与结构化对比' },
  '/opportunity': { title: '商机', subtitle: '跟踪项目机会与阶段进展' },
  '/competitor': { title: '竞对档案', subtitle: '沉淀竞品和竞争对手信息' },
  '/trip': { title: '出差', subtitle: '查看出差记录与在途状态' },
  '/attendance': { title: '考勤', subtitle: '部门出勤情况与成员明细' },
  '/links': { title: '系统链接', subtitle: '常用系统入口与外部链接' },
  '/ai': { title: 'AI 分析', subtitle: '智能问答、报告与分析' },
  '/settings': { title: '设置', subtitle: '系统参数与 AI 配置' },
  '/login': { title: '登录' },
}

function looksBroken(value?: string) {
  if (!value) return true
  return /[\ufffd]/.test(value)
}

export function PageTitle({
  title,
  subtitle,
  badge,
  icon: Icon,
  meta,
  actions,
}: PageTitleProps) {
  const location = useLocation()
  const routeMeta = location.pathname.startsWith('/ai/')
    ? PAGE_META['/ai']
    : PAGE_META[location.pathname]

  const heading = !looksBroken(title) ? title : routeMeta?.title ?? '首页'
  const description = !looksBroken(subtitle) ? subtitle : routeMeta?.subtitle

  return (
    <section className="app-hero animate-slide-up">
      <div className="app-hero__content">
        <div className="flex flex-wrap items-center gap-3">
          {Icon ? (
            <div className="app-hero__icon">
              <Icon size={20} strokeWidth={1.8} />
            </div>
          ) : null}

          {badge ? <span className="app-pill app-pill-accent">{badge}</span> : null}
        </div>

        <div className="space-y-3">
          <div className="min-w-0">
            <h1 className="truncate text-title font-semibold leading-tight text-[var(--color-text-strong)] sm:text-title">
              {heading}
            </h1>
            {description ? (
              <p className="mt-3 max-w-3xl text-body leading-7 text-[var(--color-text-muted)] sm:text-body">
                {description}
              </p>
            ) : null}
          </div>

          {meta && meta.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {meta.map((item) => (
                <div key={`${item.label}-${item.value}`} className="app-hero__meta">
                  <span className="app-hero__meta-label">{item.label}</span>
                  <span className="app-hero__meta-value">{item.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {actions ? <div className="app-hero__actions">{actions}</div> : null}
    </section>
  )
}
