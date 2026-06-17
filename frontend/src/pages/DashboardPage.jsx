import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups } from '../api/groups'
import { LEVEL_COLORS } from '../constants/domain'
export default function DashboardPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getGroups()
      .then((res) => setGroups(res.data))
      .catch(() => setError('Errore nel caricamento dei gruppi'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Gruppi attivi</div>
          <div className="text-3xl font-bold text-granata">
            {loading ? '–' : groups.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Stagione</div>
          <div className="text-3xl font-bold text-gray-900">2026-2027</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Ultimo accesso</div>
          <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">{today}</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Gruppi</h2>
        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-granata hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{g.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[g.level] ?? 'bg-gray-100 text-gray-600'}`}>
                    {g.level}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
