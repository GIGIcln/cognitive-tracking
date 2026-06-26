import { useQuery } from '@tanstack/react-query'
import { getSession, getMeasurements, getSessionAverages, getSessionRankings } from '../api/sessions'
import { getPlayer } from '../api/players'
import { getGroup, getGroupTargets } from '../api/groups'

export function useSessionPlayerReport(sessionId: string, playerId: string) {
  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId).then((r) => r.data),
  })

  const playerQuery = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId).then((r) => r.data),
  })

  // Fetch in parallel with session — only sessionId needed
  const measQuery = useQuery({
    queryKey: ['session-measurements', sessionId],
    queryFn: () => getMeasurements(sessionId).then((r) => r.data ?? []),
  })

  const avgQuery = useQuery({
    queryKey: ['session-averages', sessionId],
    queryFn: () => getSessionAverages(sessionId).then((r) => r.data),
  })

  const rankQuery = useQuery({
    queryKey: ['session-rankings', sessionId],
    queryFn: () =>
      getSessionRankings(sessionId)
        .then((r) => r.data ?? [])
        .catch(() => []),
  })

  // Depends on session.group_id
  const groupId = sessionQuery.data?.group_id

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId).then((r) => r.data),
    enabled: !!groupId,
  })

  const targetsQuery = useQuery({
    queryKey: ['group-targets', groupId],
    queryFn: () => getGroupTargets(groupId).then((r) => r.data ?? []),
    enabled: !!groupId,
  })

  const player = playerQuery.data
  const allMeasurements = measQuery.data ?? []

  const loading =
    sessionQuery.isPending ||
    playerQuery.isPending ||
    measQuery.isPending ||
    avgQuery.isPending ||
    rankQuery.isPending ||
    (!!groupId && (groupQuery.isPending || targetsQuery.isPending))

  const error =
    sessionQuery.isError || playerQuery.isError || measQuery.isError || avgQuery.isError
      ? 'Errore nel caricamento del report'
      : ''

  const rankings = rankQuery.data ?? []

  return {
    session: sessionQuery.data ?? null,
    groupName: groupQuery.data?.name ?? '',
    playerName: player ? `${player.first_name} ${player.last_name}` : '',
    playerFirstName: player?.first_name ?? '',
    playerLastName: player?.last_name ?? '',
    playerPosition: player?.position ?? null,
    measurement: (allMeasurements as { player_id: string; [key: string]: unknown }[]).find((m) => m.player_id === playerId) ?? null,
    averages: avgQuery.data ?? null,
    playerRanking: (rankings as { player_id: string; [key: string]: unknown }[]).find((r) => r.player_id === playerId) ?? null,
    targets: targetsQuery.data ?? [],
    loading,
    error,
  }
}
