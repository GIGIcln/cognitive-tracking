import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups } from '../api/groups'
import { LEVEL_COLORS, GROUP_CATEGORIES } from '../constants/domain'

export default function GroupsPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getGroups()
      .then((res) => setGroups(res.data))
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [])

  const byCategory = (cat) => groups.filter((g) => g.category === cat)
  const uncategorized = groups.filter((g) => !GROUP_CATEGORIES.includes(g.category))

  const GroupCard = ({ g }) => (
    <button
      onClick={() => navigate(`/groups/${g.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-granata hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-900">{g.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[g.level] ?? 'bg-gray-100 text-gray-600'}`}>
          {g.level}
        </span>
      </div>
      <div className="text-xs text-gray-500">Max {g.max_players} giocatori</div>
    </button>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gruppi</h1>
      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_CATEGORIES.map((cat) => {
            const list = byCategory(cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {cat}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map((g) => <GroupCard key={g.id} g={g} />)}
                </div>
              </div>
            )
          })}
          {uncategorized.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Altri
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uncategorized.map((g) => <GroupCard key={g.id} g={g} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
