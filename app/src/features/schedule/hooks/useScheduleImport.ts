import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import type { ScheduleImportResult } from '../api/scheduleRepository'

const INVALID_XLSX_MESSAGE = '请选择飞书导出的 .xlsx 日历文件。'

export function useScheduleImport(
  importScheduleWorkbook: (fileName: string, bytes: number[]) => Promise<ScheduleImportResult>,
) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ScheduleImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImportClick = useCallback(() => {
    setImportResult(null)
    setImportError(null)
    fileInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file) return
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setImportError(getErrorMessage(new Error(INVALID_XLSX_MESSAGE), INVALID_XLSX_MESSAGE))
        return
      }

      setImporting(true)
      setImportResult(null)
      setImportError(null)
      try {
        const buffer = await file.arrayBuffer()
        const result = await importScheduleWorkbook(file.name, Array.from(new Uint8Array(buffer)))
        setImportResult(result)
      } catch (error) {
        console.error('[Schedule] Import failed:', error)
      } finally {
        setImporting(false)
      }
    },
    [importScheduleWorkbook],
  )

  return {
    fileInputRef,
    importing,
    importResult,
    importError,
    handleImportClick,
    handleImportFile,
  }
}
