import { useState, useEffect } from 'react'
import { getSession, getMeasurements, getSessionAverages } from '../api/sessions'
import { getGroup, getGroupTargets } from '../api/groups'

export function useSessionTeamReport(sessionId) {
  const [session, setSession] = useState(null)
  const [groupName, setGroupName] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [averages, setAverages] = useState(null)
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const sessRes = await getSession(sessionId)
        const s = sessRes.data
        setSession(s)
        const [groupRes, measRes, avgRes, tgtRes] = await Promise.all([
          getGroup(s.group_id),
          getMeasurements(sessionId),
          getSessionAverages(sessionId),
          getGroupTargets(s.group_id),
        ])
        setGroupName(groupRes.data.name)
        setMeasurements(measRes.data ?? [])
        setAverages(avgRes.data)
        setTargets(tgtRes.data ?? [])
      } catch {
        setError('Errore nel caricamento del report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  return { session, groupName, measurements, averages, targets, loading, error }
}
