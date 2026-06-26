import { useQuery } from '@tanstack/react-query'
import { getSeasons } from '../api/seasons'
import { getGroups } from '../api/groups'
import type { Season, Group } from '../types/api'

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
