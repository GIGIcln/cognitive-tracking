import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getSeasons } from '../api/seasons'
import { getGroups } from '../api/groups'

interface Season {
  id: string
  name: string
  [key: string]: unknown
}

interface Group {
  id: string
  name: string
  [key: string]: unknown
}

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
  const [seasons, setSeasons] = useState<Season[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedSeasonId, _setSeasonId] = useState(
    () => localStorage.getItem('ctx_season') ?? ''
  )
  const [selectedGroupId, _setGroupId] = useState(
    () => localStorage.getItem('ctx_group') ?? ''
  )

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

  // Fase 1: carica le stagioni e risolve la stagione selezionata
  useEffect(() => {
    getSeasons()
      .then((se) => {
        const seasonList: Season[] = Array.isArray(se.data) ? se.data as Season[] : []
        setSeasons(seasonList)

        const storedSeason = localStorage.getItem('ctx_season')
        if (!storedSeason || !seasonList.find((s) => s.id === storedSeason)) {
          const first = seasonList[0]?.id ?? ''
          _setSeasonId(first)
          if (first) localStorage.setItem('ctx_season', first)
          else localStorage.removeItem('ctx_season')
        }
      })
      .catch(() => {})
  }, [])

  // Fase 2: ricarica i gruppi ogni volta che cambia la stagione selezionata
  useEffect(() => {
    getGroups(selectedSeasonId || undefined)
      .then((gr) => {
        const groupList: Group[] = Array.isArray(gr.data) ? gr.data as Group[] : []
        setGroups(groupList)

        const storedGroup = localStorage.getItem('ctx_group')
        if (storedGroup && !groupList.find((g) => g.id === storedGroup)) {
          _setGroupId('')
          localStorage.removeItem('ctx_group')
        }
      })
      .catch(() => {})
  }, [selectedSeasonId])

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
