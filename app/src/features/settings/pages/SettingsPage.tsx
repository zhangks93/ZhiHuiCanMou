import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { buildSettingsHref } from '@/app/config/constants'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { FeishuCliPanel } from '@/features/settings/components/FeishuCliPanel'
import { LlmConfigPanel } from '@/features/settings/components/LlmConfigPanel'
import { ModuleTogglePanel } from '@/features/settings/components/ModuleTogglePanel'
import { ThresholdPanel } from '@/features/settings/components/ThresholdPanel'
import { useFeishuCliSettings } from '@/features/settings/hooks/useFeishuCliSettings'
import { useLlmSettings, type SettingsFeedback } from '@/features/settings/hooks/useLlmSettings'
import { useThresholdSettings } from '@/features/settings/hooks/useThresholdSettings'

export function Settings() {
  const [searchParams] = useSearchParams()
  const [feedback, setFeedback] = useState<SettingsFeedback>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = (message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2200)
  }

  const llm = useLlmSettings(setFeedback, showToast)
  const threshold = useThresholdSettings(setFeedback)
  const feishu = useFeishuCliSettings(searchParams, showToast)

  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab === 'ai-model' || requestedTab === 'feishu-cli' ? requestedTab : 'thresholds'
  const tabItems = [
    { key: 'thresholds', label: '预警阈值', to: buildSettingsHref('thresholds'), active: activeTab === 'thresholds' },
    { key: 'ai-model', label: 'AI 模型配置', to: buildSettingsHref('ai-model'), active: activeTab === 'ai-model' },
    { key: 'feishu-cli', label: '飞书 CLI', to: buildSettingsHref('feishu-cli'), active: activeTab === 'feishu-cli' },
  ]

  return (
    <TabbedPageShell tabs={tabItems}>
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-[70] sm:right-6">
          <div className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-emerald-100 bg-white/96 px-4 py-3 text-body text-emerald-700 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl animate-fade-in">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={16} />
            </span>
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}
      {activeTab === 'thresholds' ? (
        <div className="grid grid-cols-1 gap-6">
          <ThresholdPanel
            thresholds={threshold.thresholds}
            isEditingThresholds={threshold.isEditingThresholds}
            tempThresholds={threshold.tempThresholds}
            setTempThresholds={threshold.setTempThresholds}
            handleSaveThresholds={threshold.handleSaveThresholds}
            handleResetThresholds={threshold.handleResetThresholds}
            handleStartEdit={threshold.handleStartEdit}
            handleCancelEdit={threshold.handleCancelEdit}
            feedback={feedback}
          />
          <ModuleTogglePanel />
        </div>
      ) : activeTab === 'feishu-cli' ? (
        <FeishuCliPanel {...feishu} />
      ) : (
        <LlmConfigPanel
          provider={llm.provider}
          apiUrl={llm.apiUrl}
          apiKey={llm.apiKey}
          model={llm.model}
          setApiUrl={llm.setApiUrl}
          setApiKey={llm.setApiKey}
          setModel={llm.setModel}
          handleProviderChange={llm.handleProviderChange}
          handleSave={llm.handleSave}
          handleClear={llm.handleClear}
          providerOptions={llm.providerOptions}
          feedback={feedback}
        />
      )}
    </TabbedPageShell>
  )
}
