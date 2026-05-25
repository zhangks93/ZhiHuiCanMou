import type { useFeishuCliSettings } from '../../hooks/useFeishuCliSettings'
import { createElement } from 'react'
import { RefreshCw } from 'lucide-react'

export type FeishuProps = ReturnType<typeof useFeishuCliSettings>

export function FeishuCliTopBar(props: Pick<FeishuProps, 'feishuConnectionLabel' | 'feishuStatusLoading' | 'loadFeishuStatus'>) {
  const { feishuConnectionLabel, feishuStatusLoading, loadFeishuStatus } = props
  const badgeClass =
    'rounded-full px-3 py-1.5 text-caption font-medium ' +
    (feishuConnectionLabel === '已连接'
      ? 'bg-success-100 text-success-700'
      : feishuConnectionLabel === '授权需同步' || feishuConnectionLabel === '等待网页登录'
        ? 'bg-warning-100 text-warning-700'
        : 'bg-slate-100 text-slate-600')
  return createElement(
    'div',
    { className: 'flex flex-wrap items-start justify-between gap-3' },
    createElement(
      'div',
      null,
      createElement('h3', { className: 'font-medium text-gray-800' }, '飞书连接'),
      createElement('p', { className: 'mt-1 text-caption text-gray-500' }, '配置应用后，直接选择业务域并同步授权。'),
    ),
    createElement(
      'div',
      { className: 'flex flex-wrap items-center gap-2' },
      createElement('span', { className: badgeClass }, feishuConnectionLabel),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => void loadFeishuStatus(),
          className:
            'inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60',
          disabled: feishuStatusLoading,
          title: '刷新状态',
        },
        createElement(RefreshCw, { size: 15, className: feishuStatusLoading ? 'animate-spin' : '' }),
      ),
    ),
  )
}
