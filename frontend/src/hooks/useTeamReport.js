import { useState, useEffect } from 'react'
import { getGroup, getGroupHistory, getGroupTargets } from '../api/groups'
import { getMeasurements } from '../api/sessions'

export function useTeamReport(groupId) {
  const [groupName, setGroupName] = useState('')
  const [history, setHistory] = useState([])
  const [targets, setTargets] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [gr, hist, tgt] = await Promise.all([
          getGroup(groupId),
          getGroupHistory(groupId),
          getGroupTargets(groupId),
        ])
        const histData = hist.data ?? []
        setGroupName(gr.data.name)
        setHistory(histData)
        setTargets(tgt.data ?? [])
        if (histData.length > 0) {
          const lastSessionId = histData[histData.length - 1].session_id
          const measRes = await getMeasurements(lastSessionId)
          setMeasurements(measRes.data ?? [])
        }
      } catch {
        setError('Errore nel caricamento del report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [groupId])

  return { groupName, history, targets, measurements, loading, error }
}
