import { useEffect, useState } from 'react'
import type { OpportunityLedger } from '@/lib/supabase'
import { fetchOpportunityLedger } from '../api/opportunityRepository'

export function useOpportunityData() {
  const [allData, setAllData] = useState<OpportunityLedger[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setAllData(await fetchOpportunityLedger())
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  return {
    allData,
    loading,
  }
}
