import { AlertTriangle, Check, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ThresholdSettings } from '@/shared/lib/thresholdConfig'
import type { SettingsFeedback } from '../hooks/useLlmSettings'

export type ThresholdPanelProps = {
  thresholds: ThresholdSettings
  isEditingThresholds: boolean
  tempThresholds: ThresholdSettings
  setTempThresholds: Dispatch<SetStateAction<ThresholdSettings>>
  handleSaveThresholds: () => void | Promise<void>
  handleResetThresholds: () => void | Promise<void>
  handleStartEdit: () => void
  handleCancelEdit: () => void
  feedback: SettingsFeedback
}

export function ThresholdPanel({
  thresholds,
  isEditingThresholds,
  tempThresholds,
  setTempThresholds,
  handleSaveThresholds,
  handleResetThresholds,
  handleStartEdit,
  handleCancelEdit,
  feedback,
}: ThresholdPanelProps) {
  return (
    <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={1.5} className="text-gray-600" />
          <h3 className="font-medium text-gray-800">经营数据预警阈值</h3>
        </div>
        {!isEditingThresholds && (
          <button
            onClick={handleStartEdit}
            className="text-caption px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            编辑
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-body text-gray-600">完成率预警阈值</div>
            <div className="flex items-center gap-4">
              {isEditingThresholds ? (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-caption text-gray-600 whitespace-nowrap">黄色预警</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={(tempThresholds.default.yellowThreshold * 100).toFixed(0)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                        setTempThresholds((prev: ThresholdSettings) => ({
                          ...prev,
                          default: { ...prev.default, yellowThreshold: val / 100 }
                        }))
                      }}
                      className="input input-bordered input-sm w-16 text-center text-body"
                    />
                    <span className="text-body text-gray-600">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-caption text-gray-600 whitespace-nowrap">红色预警</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={(tempThresholds.default.redThreshold * 100).toFixed(0)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                        setTempThresholds((prev: ThresholdSettings) => ({
                          ...prev,
                          default: { ...prev.default, redThreshold: val / 100 }
                        }))
                      }}
                      className="input input-bordered input-sm w-16 text-center text-body"
                    />
                    <span className="text-body text-gray-600">%</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-caption text-gray-500">黄色</span>
                    <span className="px-2.5 py-1 bg-warning-100 text-warning-700 rounded text-body font-medium">
                      &lt; {(thresholds.default.yellowThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption text-gray-500">红色</span>
                    <span className="px-2.5 py-1 bg-error-100 text-error-700 rounded text-body font-medium">
                      &lt; {(thresholds.default.redThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {isEditingThresholds && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveThresholds}
              className="px-4 py-1.5 text-body font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Check size={14} /> 保存
            </button>
            <button
              onClick={handleResetThresholds}
              className="px-4 py-1.5 text-body font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} /> 恢复默认
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-1.5 text-body font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            {feedback && (
              <span className={`text-body ${feedback.type === 'success' ? 'text-success-700' : 'text-error-700'}`}>
                {feedback.msg}
              </span>
            )}
          </div>
        )}

        <div className="text-caption text-gray-500 leading-relaxed pt-2 border-t border-gray-200">
          <p className="mb-1">预警规则：</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>完成率 ≥ 黄色阈值：<span className="text-success-600 font-medium">正常</span></li>
            <li>红色阈值 ≤ 完成率 &lt; 黄色阈值：<span className="text-warning-600 font-medium">黄色预警</span></li>
            <li>完成率 &lt; 红色阈值：<span className="text-error-600 font-medium">红色预警</span></li>
          </ul>
          <p className="mt-2">
            成本/费用/人数/成本率类指标按“越低越好”折算；利润等目标为负数时，按“亏损收窄或转正更优”折算。
          </p>
        </div>
      </div>
    </div>
  )
}
