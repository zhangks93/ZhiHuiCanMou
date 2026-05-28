import { useEffect, useMemo, useState } from 'react'
import {
  fetchAvailableCollectionPeriods,
  fetchCollectionReceivables,
  type CollectionReceivableRow,
} from '../api/collectionRepository'
import {
  buildCollectionTree,
  collectDefaultExpandedCollectionKeys,
  collectExpandableCollectionKeys,
  flattenCollectionTreeRows,
  getCollectionOverallStats,
} from '../services/collectionTree'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function useCollectionData() {
  const [loading, setLoading] = useState(true)
  const [periodLoading, setPeriodLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [rows, setRows] = useState<CollectionReceivableRow[]>([])
  const [query, setQuery] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false

    async function loadPeriods() {
      setPeriodLoading(true)
      setError(null)
      try {
        const periods = await fetchAvailableCollectionPeriods()
        if (cancelled) return
        setAvailablePeriods(periods)
        setSelectedPeriod((current) => (current && periods.includes(current) ? current : (periods[0] ?? '')))
      } catch (loadError) {
        if (cancelled) return
        setAvailablePeriods([])
        setSelectedPeriod('')
        setError(getErrorMessage(loadError, '回款期间加载失败'))
      } finally {
        if (!cancelled) setPeriodLoading(false)
      }
    }

    void loadPeriods()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPeriod) {
      setRows([])
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadRows() {
      setLoading(true)
      setError(null)
      try {
        const nextRows = await fetchCollectionReceivables(selectedPeriod)
        if (cancelled) return
        setRows(nextRows)
        setExpandedKeys(new Set())
        setCollapsedKeys(new Set())
      } catch (loadError) {
        if (cancelled) return
        setError(getErrorMessage(loadError, '回款数据加载失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadRows()
    return () => {
      cancelled = true
    }
  }, [selectedPeriod])

  const treeRows = useMemo(() => buildCollectionTree(rows), [rows])
  const expandableKeys = useMemo(() => collectExpandableCollectionKeys(treeRows), [treeRows])
  const defaultExpandedKeys = useMemo(() => collectDefaultExpandedCollectionKeys(treeRows), [treeRows])
  const effectiveExpandedKeys = useMemo(() => {
    const next = new Set(defaultExpandedKeys)
    expandedKeys.forEach((key) => next.add(key))
    collapsedKeys.forEach((key) => next.delete(key))
    return next
  }, [collapsedKeys, defaultExpandedKeys, expandedKeys])
  const visibleRows = useMemo(
    () => flattenCollectionTreeRows(treeRows, effectiveExpandedKeys, query),
    [effectiveExpandedKeys, query, treeRows],
  )
  const overallStats = useMemo(() => getCollectionOverallStats(rows), [rows])

  const toggleRow = (key: string) => {
    if (effectiveExpandedKeys.has(key)) {
      setExpandedKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      setCollapsedKeys((current) => new Set(current).add(key))
    } else {
      setExpandedKeys((current) => new Set(current).add(key))
      setCollapsedKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
  }

  return {
    loading: periodLoading || loading,
    refreshing: loading && rows.length > 0,
    error,
    availablePeriods,
    selectedPeriod,
    setSelectedPeriod,
    query,
    setQuery: handleQueryChange,
    visibleRows,
    expandedKeys: effectiveExpandedKeys,
    expandableKeys,
    toggleRow,
    overallStats,
  }
}
