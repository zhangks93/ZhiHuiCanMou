import { PageTitle } from '@/components/ui/PageTitle'

export function AiAnalysis() {
  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 shadow-card min-h-[320px] flex items-center justify-center">
        <div className="max-w-xl text-center">
          <div className="text-base font-semibold text-[var(--color-text-strong)] mb-2">
            智能分析功能正在重新设计
          </div>
          <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            这里暂时保留一个空白框架。后续会在该页面重建新的交互与分析能力。
          </div>
        </div>
      </div>
    </>
  )
}
