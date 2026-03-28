import { useEffect, useMemo, useState } from 'react'
import { fetchBusinessTrips, type BusinessTrip } from '../api/tripRepository'

function isOngoingTrip(trip: BusinessTrip, referenceDate: Date) {
  const start = new Date(trip.start_time)
  const end = new Date(trip.end_time)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return start <= referenceDate && end >= referenceDate
}

export function useTripData() {
  const [trips, setTrips] = useState<BusinessTrip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchBusinessTrips()
      .then((records) => {
        if (!cancelled) {
          setTrips(records)
          setLoading(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[Trip] Fetch failed:', error)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const ongoingTrips = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return trips.filter((trip) => isOngoingTrip(trip, today))
  }, [trips])

  return {
    trips,
    ongoingTrips,
    loading,
  }
}
