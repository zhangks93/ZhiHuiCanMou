import { Check, Copy, ExternalLink } from 'lucide-react'
import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'
import { extractDeviceCode } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  | 'feishuAuthDirty'
  | 'feishuDomainSelectionChanged'
  | 'feishuPendingUrl'
  | 'feishuAuthLoading'
  | 'feishuAuthPayload'
  | 'handleCopyFeishuUrl'
  | 'handleFeishuAuthComplete'
>

export function FeishuCliScopesWarningsAndUrl(props: P) {
  const {
    feishuAuthDirty,
    feishuDomainSelectionChanged,
    feishuPendingUrl,
    feishuAuthLoading,
    feishuAuthPayload,
    handleCopyFeishuUrl,
    handleFeishuAuthComplete,
  } = props

  return (
    <>
      {(feishuAuthDirty || feishuDomainSelectionChanged) && (
        <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-caption text-warning-700">
          授权范围已变更，点击“同步授权”后使用新链接完成确认。
        </div>
      )}

      {feishuPendingUrl && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-caption text-slate-500">授权链接</div>
          <div className="break-all rounded-lg bg-white px-3 py-2 font-mono text-caption text-slate-700">
            {feishuPendingUrl}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(feishuPendingUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ExternalLink size={13} />
              打开
            </button>
            <button
              type="button"
              onClick={() => void handleCopyFeishuUrl()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <Copy size={13} />
              复制
            </button>
            <button
              type="button"
              onClick={() => void handleFeishuAuthComplete()}
              disabled={feishuAuthLoading || !extractDeviceCode(feishuAuthPayload)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-caption font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              <Check size={13} />
              已完成授权
            </button>
          </div>
        </div>
      )}
    </>
  )
}
