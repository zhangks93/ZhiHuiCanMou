import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  | 'feishuHealth'
  | 'feishuScopeCatalog'
  | 'feishuAuthStatus'
  | 'feishuDiagnosticsOpen'
  | 'setFeishuDiagnosticsOpen'
>

export function FeishuCliDiagCard({
  feishuHealth,
  feishuScopeCatalog,
  feishuAuthStatus,
  feishuDiagnosticsOpen,
  setFeishuDiagnosticsOpen,
}: P) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setFeishuDiagnosticsOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left text-body font-medium text-slate-800"
      >
        <span>诊断详情</span>
        <span className="text-caption text-slate-500">{feishuDiagnosticsOpen ? '收起' : '展开'}</span>
      </button>
      {feishuDiagnosticsOpen && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-caption text-slate-600">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">版本</div>
            <div className="mt-1 font-mono">{feishuHealth?.version || '-'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">应用</div>
            <div className="mt-1 font-mono">{feishuScopeCatalog?.appId || '-'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">品牌</div>
            <div className="mt-1">{feishuScopeCatalog?.brand || 'feishu'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">应用后台已开通 scope</div>
            <div className="mt-1">{feishuScopeCatalog?.appScopes.length ?? 0} 项</div>
          </div>
          <div className="col-span-2 rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">登录状态</div>
            <div className="mt-1 break-all">
              {feishuAuthStatus?.parsed_json && typeof feishuAuthStatus.parsed_json === 'object'
                ? '已获取'
                : feishuAuthStatus?.stdout
                  ? '已获取'
                  : '未获取'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
