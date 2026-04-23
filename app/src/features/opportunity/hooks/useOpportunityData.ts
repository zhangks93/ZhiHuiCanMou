import { useEffect, useState } from 'react'
import { fetchOpportunitySnapshotDates, fetchOpportunitySnapshotItems } from '../api/opportunityRepository'
import type { OpportunitySnapshotItem } from '../types'

export function useOpportunityData() {
  const [rows, setRows] = useState<OpportunitySnapshotItem[]>([])
  const [snapshotDates, setSnapshotDates] = useState<string[]>([])
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const dates = await fetchOpportunitySnapshotDates()
        setSnapshotDates(dates)
        setSelectedSnapshotDate((current) => current || dates[0] || '')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
    if (!selectedSnapshotDate) {
      setRows([])
      return
    }

    let cancelled = false

    async function loadSnapshotRows() {
      try {
        setLoading(true)
        const nextRows = await fetchOpportunitySnapshotItems(selectedSnapshotDate)
        if (!cancelled) {
          setRows(nextRows)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSnapshotRows()

    return () => {
      cancelled = true
    }
  }, [selectedSnapshotDate])

  return {
    rows,
    snapshotDates,
    selectedSnapshotDate,
    setSelectedSnapshotDate,
    loading,
  }
}
