import { useQuery } from '@tanstack/react-query'
import { getPlayer, getPlayerHistory } from '../api/players'
import { getGroupTargets } from '../api/groups'
import { getSessionAverages, getSessionRankings } from '../api/sessions'
import type { Target, PlayerHistoryItem } from '../types/api'

export function usePlayerReport(playerId: string) {
  const playerQuery = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId).then((r) => r.data),
  })

  const historyQuery = useQuery({
    queryKey: ['player-history', playerId],
    queryFn: () => getPlayerHistory(playerId).then((r) => r.data),
  })

  const history = historyQuery.data ?? []
  const last = history[history.length - 1] ?? null

  const targetsQuery = useQuery({
    queryKey: ['group-targets', last?.group_id],
    queryFn: () => getGroupTargets(last.group_id).then((r) => r.data ?? []),
    enabled: !!last,
  })

  const avgQuery = useQuery({
    queryKey: ['session-averages', last?.session_id],
    queryFn: () => getSessionAverages(last.session_id).then((r) => r.data),
    enabled: !!last,
  })

  const rankingsQuery = useQuery({
    queryKey: ['session-rankings', last?.session_id],
    queryFn: () =>
      getSessionRankings(last.session_id)
        .then((r) => r.data ?? [])
        .catch(() => []),
    enabled: !!last,
  })

  const player = playerQuery.data
  const loading =
    playerQuery.isPending ||
    historyQuery.isPending ||
    (history.length > 0 &&
      (targetsQuery.isPending || avgQuery.isPending || rankingsQuery.isPending))

  const error = playerQuery.isError
    ? (playerQuery.error as { response?: { status?: number } })?.response?.status === 404
      ? 'Giocatore non trovato'
      : 'Errore nel caricamento del report'
    : historyQuery.isError || targetsQuery.isError || avgQuery.isError
      ? 'Errore nel caricamento del report'
      : ''

  const rankings = rankingsQuery.data ?? []

  return {
    playerName: player ? `${player.first_name} ${player.last_name}` : '',
    playerFirstName: (player?.first_name ?? '') as string,
    playerLastName: (player?.last_name ?? '') as string,
    playerPosition: (player?.position ?? null) as string | null,
    history: (historyQuery.data ?? []) as PlayerHistoryItem[],
    targets: (targetsQuery.data ?? []) as Target[],
    sessionAverages: (avgQuery.data ?? null) as Record<string, number> | null,
    playerRanking: (rankings as { player_id: string; [key: string]: unknown }[]).find((r) => r.player_id === playerId) ?? null,
    loading,
    error,
  }
}
