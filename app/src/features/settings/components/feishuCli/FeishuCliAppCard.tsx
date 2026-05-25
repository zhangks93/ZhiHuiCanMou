import { Check, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  | 'feishuConfigured'
  | 'showFeishuConfigForm'
  | 'feishuAppId'
  | 'setFeishuAppId'
  | 'feishuAppSecret'
  | 'setFeishuAppSecret'
  | 'setFeishuConfigEditing'
  | 'feishuSetupLoading'
  | 'handleFeishuConfigInit'
  | 'handleFeishuConfigRemove'
>

export function FeishuCliAppCard(props: P) {
  const {
    feishuConfigured,
    showFeishuConfigForm,
    feishuAppId,
    setFeishuAppId,
    feishuAppSecret,
    setFeishuAppSecret,
    setFeishuConfigEditing,
    feishuSetupLoading,
    handleFeishuConfigInit,
    handleFeishuConfigRemove,
  } = props

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-body font-medium text-slate-800">飞书应用</div>
        {feishuConfigured && !showFeishuConfigForm && (
          <button
            type="button"
            onClick={() => setFeishuConfigEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <Settings2 size={13} />
            修改
          </button>
        )}
      </div>
      {showFeishuConfigForm ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="feishu-app-id" className="mb-1.5 block text-caption text-slate-600">App ID</label>
              <input
                id="feishu-app-id"
                type="text"
                value={feishuAppId}
                onChange={(event) => setFeishuAppId(event.target.value)}
                className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                placeholder="cli_a..."
              />
            </div>
            <div>
              <label htmlFor="feishu-app-secret" className="mb-1.5 block text-caption text-slate-600">App Secret</label>
              <input
                id="feishu-app-secret"
                type="password"
                value={feishuAppSecret}
                onChange={(event) => setFeishuAppSecret(event.target.value)}
                className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                placeholder="仅通过本机 CLI 保存"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleFeishuConfigInit()}
              disabled={feishuSetupLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              {feishuSetupLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              保存应用
            </button>
            {feishuConfigured && (
              <button
                type="button"
                onClick={() => setFeishuConfigEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200"
              >
                取消
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleFeishuConfigRemove()}
              disabled={feishuSetupLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
            >
              <Trash2 size={14} />
              清除
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-body text-slate-600">应用已配置，可直接同步授权范围。</div>
      )}
    </div>
  )
}
