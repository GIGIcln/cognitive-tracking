import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSeasons, useGroups } from '../hooks/useSeasonData'
import type { Season, Group } from '../types/api'

interface SeasonGroupContextValue {
  seasons: Season[]
  groups: Group[]
  selectedSeasonId: string
  selectedGroupId: string
  selectedSeason: Season | null
  selectedGroup: Group | null
  setSelectedSeasonId: (id: string) => void
  setSelectedGroupId: (id: string) => void
}

const SeasonGroupContext = createContext<SeasonGroupContextValue | null>(null)

export function SeasonGroupProvider({ children }: { children: ReactNode }) {
  const [selectedSeasonId, _setSeasonId] = useState(
    () => localStorage.getItem('ctx_season') ?? ''
  )
  const [selectedGroupId, _setGroupId] = useState(
    () => localStorage.getItem('ctx_group') ?? ''
  )

  const { data: seasons = [] } = useSeasons()
  const { data: groups = [] } = useGroups(selectedSeasonId || undefined)

  const setSelectedSeasonId = useCallback((id: string) => {
    _setSeasonId(id)
    if (id) localStorage.setItem('ctx_season', id)
    else localStorage.removeItem('ctx_season')
  }, [])

  const setSelectedGroupId = useCallback((id: string) => {
    _setGroupId(id)
    if (id) localStorage.setItem('ctx_group', id)
    else localStorage.removeItem('ctx_group')
  }, [])

  // Fase 1: risolve la stagione selezionata quando i dati arrivano
  useEffect(() => {
    if (!seasons.length) return
    const storedSeason = localStorage.getItem('ctx_season')
    if (!storedSeason || !seasons.find((s) => s.id === storedSeason)) {
      const first = seasons[0]?.id ?? ''
      _setSeasonId(first)
      if (first) localStorage.setItem('ctx_season', first)
      else localStorage.removeItem('ctx_season')
    }
  }, [seasons])

  // Fase 2: invalida il gruppo selezionato se non è più nella lista
  useEffect(() => {
    if (!groups.length) return
    const storedGroup = localStorage.getItem('ctx_group')
    if (storedGroup && !groups.find((g) => g.id === storedGroup)) {
      _setGroupId('')
      localStorage.removeItem('ctx_group')
    }
  }, [groups])

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null
  const selectedGroup  = groups.find((g) => g.id === selectedGroupId)  ?? null

  return (
    <SeasonGroupContext.Provider value={{
      seasons, groups,
      selectedSeasonId, selectedGroupId,
      selectedSeason, selectedGroup,
      setSelectedSeasonId, setSelectedGroupId,
    }}>
      {children}
    </SeasonGroupContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSeasonGroup = (): SeasonGroupContextValue => {
  const ctx = useContext(SeasonGroupContext)
  if (!ctx) throw new Error('useSeasonGroup deve essere usato dentro SeasonGroupProvider')
  return ctx
}
