import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups } from '../api/groups'
import { getCurrentSeason } from '../api/seasons'
import { getAtRiskPlayers } from '../api/players'
import { LEVEL_COLORS } from '../constants/domain'

export default function DashboardPage() {
  const [groups, setGroups] = useState([])
  const [season, setSeason] = useState(null)
  const [atRisk, setAtRisk] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getGroups().catch(() => ({ data: [] })),
      getCurrentSeason().catch(() => ({ data: null })),
      getAtRiskPlayers().catch(() => ({ data: [] })),
    ])
      .then(([gr, se, ar]) => {
        setGroups(gr.data)
        setSeason(se.data)
        setAtRisk(ar.data ?? [])
      })
      .catch(() => setError('Errore nel caricamento'))
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
          <div className="text-3xl font-bold text-gray-900">
            {loading ? '–' : (season?.name ?? '—')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Ultimo accesso</div>
          <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">{today}</div>
        </div>
      </div>

      {!loading && atRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-600 font-semibold text-sm">
              Allerta — {atRisk.length} {atRisk.length === 1 ? 'giocatore' : 'giocatori'} sotto soglia per 3 sessioni consecutive
            </span>
          </div>
          <div className="space-y-2">
            {atRisk.map((p) => (
              <button
                key={p.player_id}
                onClick={() => navigate(`/reports/player/${p.player_id}`)}
                className="w-full flex items-center justify-between bg-white border border-red-100 rounded-lg px-4 py-2.5 text-left hover:border-red-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{p.group_name}</span>
                </div>
                <div className="text-xs text-red-600 font-medium shrink-0">
                  {p.avg_score_last_session.toFixed(1)} / {p.threshold.toFixed(1)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
