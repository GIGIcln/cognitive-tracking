import { useQuery } from '@tanstack/react-query'
import { getGroup, getGroupHistory, getGroupTargets } from '../api/groups'
import { getMeasurements } from '../api/sessions'
import type { Target, GroupHistoryItem, Measurement } from '../types/api'

export function useTeamReport(groupId: string) {
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId).then((r) => r.data),
  })

  const historyQuery = useQuery({
    queryKey: ['group-history', groupId],
    queryFn: () => getGroupHistory(groupId).then((r) => r.data ?? []),
  })

  const targetsQuery = useQuery({
    queryKey: ['group-targets', groupId],
    queryFn: () => getGroupTargets(groupId).then((r) => r.data ?? []),
  })

  const history = historyQuery.data ?? []
  const lastSessionId = history[history.length - 1]?.session_id ?? null

  const measQuery = useQuery({
    queryKey: ['session-measurements', lastSessionId],
    queryFn: () => getMeasurements(lastSessionId).then((r) => r.data ?? []),
    enabled: !!lastSessionId,
  })

  const loading =
    groupQuery.isPending ||
    historyQuery.isPending ||
    targetsQuery.isPending ||
    (!!lastSessionId && measQuery.isPending)

  const error =
    groupQuery.isError || historyQuery.isError || targetsQuery.isError || measQuery.isError
      ? 'Errore nel caricamento del report'
      : ''

  return {
    groupName: (groupQuery.data?.name ?? '') as string,
    history: (historyQuery.data ?? []) as GroupHistoryItem[],
    targets: (targetsQuery.data ?? []) as Target[],
    measurements: (measQuery.data ?? []) as Measurement[],
    loading,
    error,
  }
}
