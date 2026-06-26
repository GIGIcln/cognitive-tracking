import { useQuery } from '@tanstack/react-query'
import { getSession, getMeasurements, getSessionAverages } from '../api/sessions'
import { getGroup, getGroupTargets } from '../api/groups'
import type { Measurement, Target, Session } from '../types/api'

export function useSessionTeamReport(sessionId: string) {
  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId).then((r) => r.data),
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

  const loading =
    sessionQuery.isPending ||
    measQuery.isPending ||
    avgQuery.isPending ||
    (!!groupId && (groupQuery.isPending || targetsQuery.isPending))

  const error =
    sessionQuery.isError || measQuery.isError || avgQuery.isError
      ? 'Errore nel caricamento del report'
      : ''

  return {
    session: (sessionQuery.data ?? null) as Session | null,
    groupName: (groupQuery.data?.name ?? '') as string,
    measurements: (measQuery.data ?? []) as Measurement[],
    averages: (avgQuery.data ?? null) as Record<string, number> | null,
    targets: (targetsQuery.data ?? []) as Target[],
    loading,
    error,
  }
}
