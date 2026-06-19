import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getGroups } from '../api/groups'
import { getCurrentSeason } from '../api/seasons'
import { getPlayers, getAtRiskPlayers } from '../api/players'
import { getSessions } from '../api/sessions'
import { LEVEL_COLORS } from '../constants/domain'

const SESSION_TYPE_LABELS = {
  training: 'Allenamento',
  match: 'Partita',
  test: 'Test',
}

function StatCard({ label, value, loading, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900">
        {loading ? <span className="text-gray-300">–</span> : value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [groups, setGroups] = useState([])
  const [season, setSeason] = useState(null)
  const [atRisk, setAtRisk] = useState([])
  const [showAllRisk, setShowAllRisk] = useState(false)
  const [totalPlayers, setTotalPlayers] = useState(null)
  const [totalSessions, setTotalSessions] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getGroups().catch(() => ({ data: [] })),
      getCurrentSeason().catch(() => ({ data: null })),
      getAtRiskPlayers().catch(() => ({ data: [] })),
      getPlayers().catch(() => ({ data: { total: null } })),
      getSessions(null, 5).catch(() => ({ data: { items: [], total: null } })),
    ]).then(([gr, se, ar, pl, ss]) => {
      setGroups(gr.data)
      setSeason(se.data)
      setAtRisk(ar.data ?? [])
      setTotalPlayers(pl.data?.total ?? null)
      setTotalSessions(ss.data?.total ?? null)
      setRecentSessions(ss.data?.items ?? [])
    }).catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [])

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Stagione" value={season?.name ?? '—'} loading={loading} />
        <StatCard label="Gruppi attivi" value={groups.length} loading={loading} />
        <StatCard label="Giocatori" value={totalPlayers ?? '—'} loading={loading} />
        <StatCard label="Sessioni totali" value={totalSessions ?? '—'} loading={loading} />
      </div>

      {/* At-risk alert */}
      {!loading && atRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-red-600 font-semibold text-sm">
              {atRisk.length} {atRisk.length === 1 ? 'giocatore' : 'giocatori'} sotto soglia per 3 sessioni consecutive
            </span>
            <Link to="/players" className="text-xs text-red-500 hover:text-red-700 font-medium">
              Vedi tutti →
            </Link>
          </div>
          <div className="space-y-2">
            {(showAllRisk ? atRisk : atRisk.slice(0, 4)).map((p) => (
              <button
                key={p.player_id}
                onClick={() => navigate(`/players/${p.player_id}`)}
                className="w-full flex items-center justify-between bg-white border border-red-100 rounded-lg px-4 py-2.5 text-left hover:border-red-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {p.last_name} {p.first_name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{p.group_name}</span>
                </div>
                <div className="text-xs text-red-600 font-semibold shrink-0">
                  {p.avg_score_last_session.toFixed(1)} / {p.threshold.toFixed(1)}
                </div>
              </button>
            ))}
          </div>
          {atRisk.length > 4 && (
            <button
              onClick={() => setShowAllRisk((v) => !v)}
              className="mt-3 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              {showAllRisk ? 'Mostra meno' : `Mostra tutti (${atRisk.length})`}
            </button>
          )}
        </div>
      )}

      {/* Sessioni recenti */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Sessioni recenti</h2>
          <Link to="/sessions" className="text-xs text-granata hover:text-granata-dark font-medium">
            Vedi tutte →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-4 border-granata border-t-transparent" />
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Nessuna sessione registrata</div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const group = groupMap[s.group_id]
              const label = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type
              const date = new Date(s.session_date).toLocaleDateString('it-IT', {
                weekday: 'short', day: '2-digit', month: 'short',
              })
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between text-left hover:border-granata hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 rounded-full bg-granata/20 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {group?.name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 capitalize">{date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {group && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[group.level] ?? 'bg-gray-100 text-gray-600'}`}>
                        {group.level}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
