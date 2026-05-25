import { RefreshCw } from 'lucide-react'
import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  | 'selectedFeishuDomainLabels'
  | 'feishuConfigured'
  | 'feishuAuthLoading'
  | 'feishuAuthDomains'
  | 'handleFeishuAuthSync'
>

export function FeishuCliScopesHeader(props: P) {
  const {
    selectedFeishuDomainLabels,
    feishuConfigured,
    feishuAuthLoading,
    feishuAuthDomains,
    handleFeishuAuthSync,
  } = props

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-body font-medium text-slate-800">授权范围</div>
        <p className="mt-1 text-caption text-slate-500">
          已选择：{selectedFeishuDomainLabels.length ? selectedFeishuDomainLabels.join('、') : '未选择'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleFeishuAuthSync()}
        disabled={feishuAuthLoading || !feishuConfigured || feishuAuthDomains.length === 0}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
      >
        {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        同步授权
      </button>
    </div>
  )
}
