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

  useEffect(() => {
    if (!selectedFeeEffectBatchId) {
      setPersonSummaries([])
      setProjectSummaries([])
      setPersonTravelProjects([])
      setPersonHospitalityProjects([])
      return
    }

    let cancelled = false

    async function loadFeeEffectData() {
      try {
        setFeeEffectLoading(true)
        setError(null)
        const [people, projects, travelProjects, hospitalityProjects] = await Promise.all([
          fetchFeeEffectPersonSummaries(selectedFeeEffectBatchId),
          fetchFeeEffectProjectSummaries(selectedFeeEffectBatchId),
          fetchFeeEffectPersonTravelProjects(selectedFeeEffectBatchId),
          fetchFeeEffectPersonHospitalityProjects(selectedFeeEffectBatchId),
        ])
        if (cancelled) return
        setPersonSummaries(people)
        setProjectSummaries(projects)
        setPersonTravelProjects(travelProjects)
        setPersonHospitalityProjects(hospitalityProjects)
      } catch (loadError) {
        if (!cancelled) {
          console.error('[Trip] Fee effect fetch failed:', loadError)
          setError(loadError instanceof Error ? loadError.message : '费效数据加载失败')
        }
      } finally {
        if (!cancelled) {
          setFeeEffectLoading(false)
        }
      }
    }

    void loadFeeEffectData()

    return () => {
      cancelled = true
    }
  }, [selectedFeeEffectBatchId])

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
    error,
    feeEffectBatches,
    selectedFeeEffectBatch,
    selectedFeeEffectBatchId,
    setSelectedFeeEffectBatchId,
    feeEffectOverview,
    personSummaries,
    projectSummaries,
    personTravelProjects,
    personHospitalityProjects,
  }
}
