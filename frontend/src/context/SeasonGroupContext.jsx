import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSeasons } from '../api/seasons'
import { getGroups } from '../api/groups'

const SeasonGroupContext = createContext(null)

export function SeasonGroupProvider({ children }) {
  const [seasons, setSeasons] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedSeasonId, _setSeasonId] = useState(
    () => localStorage.getItem('ctx_season') ?? ''
  )
  const [selectedGroupId, _setGroupId] = useState(
    () => localStorage.getItem('ctx_group') ?? ''
  )

  const setSelectedSeasonId = useCallback((id) => {
    _setSeasonId(id)
    if (id) localStorage.setItem('ctx_season', id)
    else localStorage.removeItem('ctx_season')
  }, [])

  const setSelectedGroupId = useCallback((id) => {
    _setGroupId(id)
    if (id) localStorage.setItem('ctx_group', id)
    else localStorage.removeItem('ctx_group')
  }, [])

  useEffect(() => {
    Promise.all([
      getSeasons().catch(() => ({ data: [] })),
      getGroups().catch(() => ({ data: [] })),
    ]).then(([se, gr]) => {
      const seasonList = Array.isArray(se.data) ? se.data : []
      const groupList = Array.isArray(gr.data) ? gr.data : []
      setSeasons(seasonList)
      setGroups(groupList)

      const storedSeason = localStorage.getItem('ctx_season')
      if (!storedSeason || !seasonList.find((s) => s.id === storedSeason)) {
        const first = seasonList[0]?.id ?? ''
        _setSeasonId(first)
        if (first) localStorage.setItem('ctx_season', first)
        else localStorage.removeItem('ctx_season')
      }

      const storedGroup = localStorage.getItem('ctx_group')
      if (storedGroup && !groupList.find((g) => g.id === storedGroup)) {
        // valore salvato non più valido → resetta a "tutti"
        _setGroupId('')
        localStorage.removeItem('ctx_group')
      }
    })
  }, [])

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
export const useSeasonGroup = () => useContext(SeasonGroupContext)
