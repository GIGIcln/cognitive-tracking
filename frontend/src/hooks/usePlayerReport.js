import { useState, useEffect } from 'react'
import { getPlayer, getPlayerHistory } from '../api/players'
import { getGroupTargets } from '../api/groups'
import { getSessionAverages, getSessionRankings } from '../api/sessions'

export function usePlayerReport(playerId) {
  const [playerName, setPlayerName] = useState('')
  const [playerFirstName, setPlayerFirstName] = useState('')
  const [playerLastName, setPlayerLastName] = useState('')
  const [playerPosition, setPlayerPosition] = useState(null)
  const [history, setHistory] = useState([])
  const [targets, setTargets] = useState([])
  const [sessionAverages, setSessionAverages] = useState(null)
  const [playerRanking, setPlayerRanking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    const load = async () => {
      try {
        const [playerRes, historyRes] = await Promise.all([
          getPlayer(playerId, { signal }),
          getPlayerHistory(playerId, { signal }),
        ])

        const hist = historyRes.data
        setHistory(hist)

        const { first_name, last_name, position } = playerRes.data
        setPlayerName(`${first_name} ${last_name}`)
        setPlayerFirstName(first_name)
        setPlayerLastName(last_name)
        setPlayerPosition(position ?? null)

        if (hist.length > 0) {
          const last = hist[hist.length - 1]
          const [targetsRes, avgRes, rankingsRes] = await Promise.all([
            getGroupTargets(last.group_id, { signal }),
            getSessionAverages(last.session_id, { signal }),
            getSessionRankings(last.session_id, { signal }).catch(() => ({ data: [] })),
          ])
          setTargets(targetsRes.data ?? [])
          setSessionAverages(avgRes.data)
          const rankings = rankingsRes.data ?? []
          const mine = rankings.find((r) => r.player_id === playerId)
          setPlayerRanking(mine ?? null)
        }
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return
        if (err.response?.status === 404) {
          setError('Giocatore non trovato')
        } else {
          setError('Errore nel caricamento del report')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [playerId])

  return {
    playerName,
    playerFirstName,
    playerLastName,
    playerPosition,
    history,
    targets,
    sessionAverages,
    playerRanking,
    loading,
    error,
  }
}
