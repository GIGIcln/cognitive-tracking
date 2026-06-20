import { useState, useEffect } from 'react'
import { getSession, getMeasurements, getSessionAverages, getSessionRankings } from '../api/sessions'
import { getPlayer } from '../api/players'
import { getGroup, getGroupTargets } from '../api/groups'

export function useSessionPlayerReport(sessionId, playerId) {
  const [session, setSession] = useState(null)
  const [groupName, setGroupName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerFirstName, setPlayerFirstName] = useState('')
  const [playerLastName, setPlayerLastName] = useState('')
  const [playerPosition, setPlayerPosition] = useState(null)
  const [measurement, setMeasurement] = useState(null)
  const [averages, setAverages] = useState(null)
  const [playerRanking, setPlayerRanking] = useState(null)
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [sessRes, playerRes] = await Promise.all([
          getSession(sessionId),
          getPlayer(playerId),
        ])
        const s = sessRes.data
        setSession(s)
        const { first_name, last_name, position } = playerRes.data
        setPlayerName(`${first_name} ${last_name}`)
        setPlayerFirstName(first_name)
        setPlayerLastName(last_name)
        setPlayerPosition(position ?? null)

        const [groupRes, measRes, avgRes, rankRes, tgtRes] = await Promise.all([
          getGroup(s.group_id),
          getMeasurements(sessionId),
          getSessionAverages(sessionId),
          getSessionRankings(sessionId).catch(() => ({ data: [] })),
          getGroupTargets(s.group_id),
        ])
        setGroupName(groupRes.data.name)
        const allMeasurements = measRes.data ?? []
        setMeasurement(allMeasurements.find((m) => m.player_id === playerId) ?? null)
        setAverages(avgRes.data)
        const mine = (rankRes.data ?? []).find((r) => r.player_id === playerId)
        setPlayerRanking(mine ?? null)
        setTargets(tgtRes.data ?? [])
      } catch {
        setError('Errore nel caricamento del report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, playerId])

  return {
    session,
    groupName,
    playerName,
    playerFirstName,
    playerLastName,
    playerPosition,
    measurement,
    averages,
    playerRanking,
    targets,
    loading,
    error,
  }
}
