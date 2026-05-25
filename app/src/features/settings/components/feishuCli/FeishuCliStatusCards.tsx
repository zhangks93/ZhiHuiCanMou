import { Check, KeyRound, ShieldCheck } from 'lucide-react'
import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  'feishuHealth' | 'feishuConfigured' | 'feishuAuthenticated'
>

export function FeishuCliStatusCards({ feishuHealth, feishuConfigured, feishuAuthenticated }: P) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-2 text-caption text-slate-500"><ShieldCheck size={15} /> CLI</div>
        <div className={feishuHealth?.installed ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
          {feishuHealth ? (feishuHealth.installed ? '内置可用' : '未检测到') : '尚未检查'}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-2 text-caption text-slate-500"><KeyRound size={15} /> 应用配置</div>
        <div className={feishuConfigured ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
          {feishuHealth ? (feishuConfigured ? '已配置' : '未配置') : '尚未检查'}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-2 text-caption text-slate-500"><Check size={15} /> 用户授权</div>
        <div className={feishuAuthenticated ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
          {feishuHealth ? (feishuAuthenticated ? '已授权' : '未授权') : '尚未检查'}
        </div>
      </div>
    </div>
  )
}
