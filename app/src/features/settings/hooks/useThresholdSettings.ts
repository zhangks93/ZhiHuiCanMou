import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  loadThresholdSettings,
  saveThresholdSettings,
  resetThresholdSettings,
  DEFAULT_THRESHOLDS,
  type ThresholdSettings,
} from '@/shared/lib/thresholdConfig'
import type { SettingsFeedback } from './useLlmSettings'

export function useThresholdSettings(setFeedback: Dispatch<SetStateAction<SettingsFeedback>>) {
  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => loadThresholdSettings())
  const [isEditingThresholds, setIsEditingThresholds] = useState(false)
  const [tempThresholds, setTempThresholds] = useState<ThresholdSettings>(thresholds)

  const handleSaveThresholds = async () => {
    if (tempThresholds.default.yellowThreshold <= tempThresholds.default.redThreshold) {
      setFeedback({ type: 'error', msg: '黄色预警阈值必须大于红色预警阈值' })
      return
    }

    try {
      await saveThresholdSettings(tempThresholds)
    } catch {
      setFeedback({ type: 'error', msg: '预警阈值保存失败' })
      return
    }
    setThresholds(tempThresholds)
    setIsEditingThresholds(false)

    setFeedback({ type: 'success', msg: '预警阈值已保存' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleResetThresholds = async () => {
    try {
      await resetThresholdSettings()
    } catch {
      setFeedback({ type: 'error', msg: '恢复默认失败' })
      return
    }
    setThresholds(DEFAULT_THRESHOLDS)
    setTempThresholds(DEFAULT_THRESHOLDS)
    setIsEditingThresholds(false)
    setFeedback({ type: 'success', msg: '已恢复默认阈值' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleStartEdit = () => {
    setTempThresholds(thresholds)
    setIsEditingThresholds(true)
  }

  const handleCancelEdit = () => {
    setTempThresholds(thresholds)
    setIsEditingThresholds(false)
  }

  return {
    thresholds,
    isEditingThresholds,
    tempThresholds,
    setTempThresholds,
    handleSaveThresholds,
    handleResetThresholds,
    handleStartEdit,
    handleCancelEdit,
  }
}
