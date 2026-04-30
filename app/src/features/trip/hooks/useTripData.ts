import { useEffect, useMemo, useState } from 'react'
import {
  fetchBusinessTrips,
  fetchFeeEffectBatches,
  fetchFeeEffectPersonHospitalityProjects,
  fetchFeeEffectPersonSummaries,
  fetchFeeEffectPersonTravelProjects,
  fetchFeeEffectProjectSummaries,
  type BusinessTrip,
  type FeeEffectBatch,
  type FeeEffectPersonHospitalityProject,
  type FeeEffectPersonSummary,
  type FeeEffectPersonTravelProject,
  type FeeEffectProjectSummary,
} from '../api/tripRepository'

export type FeeEffectSheetMode = 'personSummary' | 'personTravel' | 'personHospitality' | 'projectSummary'

function isOngoingTrip(trip: BusinessTrip, referenceDate: Date) {
  if (!trip.start_time || !trip.end_time) return false
  const start = new Date(trip.start_time)
  const end = new Date(trip.end_time)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return start <= referenceDate && end >= referenceDate
}

function sumBy<T>(rows: T[], getValue: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + (getValue(row) ?? 0), 0)
}

export function useTripData() {
  const [trips, setTrips] = useState<BusinessTrip[]>([])
  const [feeEffectBatches, setFeeEffectBatches] = useState<FeeEffectBatch[]>([])
  const [selectedFeeEffectBatchId, setSelectedFeeEffectBatchId] = useState('')
  const [personSummaries, setPersonSummaries] = useState<FeeEffectPersonSummary[]>([])
  const [projectSummaries, setProjectSummaries] = useState<FeeEffectProjectSummary[]>([])
  const [personTravelProjects, setPersonTravelProjects] = useState<FeeEffectPersonTravelProject[]>([])
  const [personHospitalityProjects, setPersonHospitalityProjects] = useState<FeeEffectPersonHospitalityProject[]>([])
  const [loading, setLoading] = useState(true)
  const [feeEffectLoading, setFeeEffectLoading] = useState(false)
  const [loadingSheetMode, setLoadingSheetMode] = useState<FeeEffectSheetMode | null>(null)
  const [activeSheetMode, setActiveSheetMode] = useState<FeeEffectSheetMode>('personSummary')
  const [loadedSheetKeys, setLoadedSheetKeys] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        setLoading(true)
        setError(null)
        const [tripRecords, batches] = await Promise.all([
          fetchBusinessTrips(),
          fetchFeeEffectBatches(),
        ])
        if (cancelled) return
        setTrips(tripRecords)
        setFeeEffectBatches(batches)
        setSelectedFeeEffectBatchId((current) => current || batches[0]?.id || '')
      } catch (loadError) {
        if (!cancelled) {
          console.error('[Trip] Fetch failed:', loadError)
          setError(loadError instanceof Error ? loadError.message : '数据加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedSheetKey = useMemo(
    () => `${selectedFeeEffectBatchId}:${activeSheetMode}`,
    [activeSheetMode, selectedFeeEffectBatchId],
  )

  useEffect(() => {
    if (!selectedFeeEffectBatchId) {
      setPersonSummaries([])
      setProjectSummaries([])
      setPersonTravelProjects([])
      setPersonHospitalityProjects([])
      setLoadedSheetKeys(new Set())
      return
    }

    let cancelled = false

    async function loadFeeEffectData() {
      if (loadedSheetKeys.has(selectedSheetKey)) {
        return
      }

      try {
        setFeeEffectLoading(true)
        setLoadingSheetMode(activeSheetMode)
        setError(null)
        const rows = activeSheetMode === 'personTravel'
          ? await fetchFeeEffectPersonTravelProjects(selectedFeeEffectBatchId)
          : activeSheetMode === 'personHospitality'
            ? await fetchFeeEffectPersonHospitalityProjects(selectedFeeEffectBatchId)
            : activeSheetMode === 'projectSummary'
              ? await fetchFeeEffectProjectSummaries(selectedFeeEffectBatchId)
              : await fetchFeeEffectPersonSummaries(selectedFeeEffectBatchId)

        if (cancelled) return
        if (activeSheetMode === 'personTravel') {
          setPersonTravelProjects(rows as FeeEffectPersonTravelProject[])
        } else if (activeSheetMode === 'personHospitality') {
          setPersonHospitalityProjects(rows as FeeEffectPersonHospitalityProject[])
        } else if (activeSheetMode === 'projectSummary') {
          setProjectSummaries(rows as FeeEffectProjectSummary[])
        } else {
          setPersonSummaries(rows as FeeEffectPersonSummary[])
        }
        setLoadedSheetKeys((current) => new Set(current).add(selectedSheetKey))
      } catch (loadError) {
        if (!cancelled) {
          console.error('[Trip] Fee effect fetch failed:', loadError)
          setError(loadError instanceof Error ? loadError.message : '费效数据加载失败')
        }
      } finally {
        if (!cancelled) {
          setFeeEffectLoading(false)
          setLoadingSheetMode(null)
        }
      }
    }

    void loadFeeEffectData()

    return () => {
      cancelled = true
    }
  }, [activeSheetMode, loadedSheetKeys, selectedFeeEffectBatchId, selectedSheetKey])

  const ongoingTrips = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return trips.filter((trip) => isOngoingTrip(trip, today))
  }, [trips])

  const selectedFeeEffectBatch = useMemo(() => {
    return feeEffectBatches.find((batch) => batch.id === selectedFeeEffectBatchId) ?? null
  }, [feeEffectBatches, selectedFeeEffectBatchId])

  const feeEffectOverview = useMemo(() => {
    const travelAmount = sumBy(projectSummaries, (row) => row.travel_total_amount)
    const hospitalityAmount = sumBy(projectSummaries, (row) => row.hospitality_total_amount)
    const bonusAmount = sumBy(projectSummaries, (row) => row.paid_market_bonus_amount)
    const totalExpense = sumBy(projectSummaries, (row) => row.total_expense_amount)
    const signingProfit = sumBy(projectSummaries, (row) => row.first_year_profit_amount)
    const projectsWithExpense = projectSummaries.filter((row) => (row.total_expense_amount ?? 0) > 0).length

    return {
      travelAmount,
      hospitalityAmount,
      bonusAmount,
      totalExpense,
      signingProfit,
      projectsWithExpense,
      roi: totalExpense > 0 ? signingProfit / totalExpense : null,
    }
  }, [projectSummaries])

  return {
    trips,
    ongoingTrips,
    loading,
    feeEffectLoading,
    loadingSheetMode,
    activeSheetLoading: feeEffectLoading && loadingSheetMode === activeSheetMode,
    activeSheetLoaded: loadedSheetKeys.has(selectedSheetKey),
    error,
    feeEffectBatches,
    selectedFeeEffectBatch,
    selectedFeeEffectBatchId,
    setSelectedFeeEffectBatchId,
    activeSheetMode,
    setActiveSheetMode,
    feeEffectOverview,
    personSummaries,
    projectSummaries,
    personTravelProjects,
    personHospitalityProjects,
  }
}
