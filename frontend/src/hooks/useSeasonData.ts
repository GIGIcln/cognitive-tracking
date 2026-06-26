import { useQuery } from '@tanstack/react-query'
import { getSeasons, getCurrentSeason } from '../api/seasons'
import { getGroups } from '../api/groups'
import { getPlayers } from '../api/players'
import { getSessions } from '../api/sessions'
import type { Season, Group, Player, Session } from '../types/api'

export function useSeasons() {
  return useQuery({
    queryKey: ['seasons'],
    queryFn: () => getSeasons().then((r) => r.data as Season[]),
  })
}

export function useGroups(seasonId?: string) {
  return useQuery({
    queryKey: ['groups', seasonId ?? ''],
    queryFn: () => getGroups(seasonId || undefined).then((r) => r.data as Group[]),
  })
}

export function useCurrentSeason() {
  return useQuery({
    queryKey: ['current-season'],
    queryFn: () => getCurrentSeason().then((r) => r.data as Season).catch(() => null),
  })
}

export function usePlayers(groupId?: string) {
  return useQuery({
    queryKey: ['players', groupId ?? ''],
    queryFn: () =>
      getPlayers(groupId || undefined).then((r) => {
        const items = (r.data.items ?? []) as Player[]
        return [...items].sort(
          (a, b) =>
            a.last_name.localeCompare(b.last_name, 'it') ||
            a.first_name.localeCompare(b.first_name, 'it'),
        )
      }),
  })
}

export function useSessions(groupId?: string, seasonId?: string) {
  return useQuery({
    queryKey: ['sessions', groupId ?? '', seasonId ?? ''],
    queryFn: () =>
      getSessions(groupId || undefined, undefined, seasonId || undefined).then(
        (r) => (r.data.items ?? []) as Session[],
      ),
  })
}
