import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'

type P = Pick<
  ReturnType<typeof useFeishuCliSettings>,
  'feishuDomains' | 'feishuAuthDomains' | 'feishuAuthLoading' | 'handleFeishuAuthDomainToggle'
>

export function FeishuCliScopesGrid({
  feishuDomains,
  feishuAuthDomains,
  feishuAuthLoading,
  handleFeishuAuthDomainToggle,
}: P) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {feishuDomains.map((option) => {
        const checked = feishuAuthDomains.includes(option.id)
        const disabled = feishuAuthLoading || (!option.available && !checked)
        return (
          <label
            key={option.id}
            className={
              'flex min-h-[4rem] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ' +
              (checked
                ? 'border-primary-200 bg-primary-50/60 text-slate-900'
                : disabled
                  ? 'border-slate-200 bg-slate-50/40 text-slate-400 opacity-60'
                  : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300')
            }
            title={option.available ? option.description : '应用后台未开通'}
          >
            <input
              type="checkbox"
              className="checkbox checkbox-sm border-slate-300"
              checked={checked}
              disabled={disabled}
              onChange={() => handleFeishuAuthDomainToggle(option.id)}
            />
            <span className="min-w-0">
              <span className="block truncate text-body font-medium">{option.label}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {option.available ? (option.recommended ? '推荐' : `${option.enabledScopeCount} 项权限`) : '未开通'}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
