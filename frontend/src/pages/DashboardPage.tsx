import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAtRiskPlayers } from '../api/players'
import { getPlayers } from '../api/players'
import { getSessions } from '../api/sessions'
import { useGroups, useCurrentSeason } from '../hooks/useSeasonData'
import { LEVEL_COLORS } from '../constants/domain'
import AvailabilityBadge from '../components/AvailabilityBadge'
import { useAuth } from '../context/AuthContext'
import type { Group, AtRiskPlayer, RecentSession, Player } from '../types/api'

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: 'Allenamento',
  match: 'Partita',
  test: 'Test',
}

type StatCardProps = { label: string; value: string | number; loading: boolean; sub?: string }
function StatCard({ label, value, loading, sub }: StatCardProps) {
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
  const { user, isAdmin, isStaff } = useAuth()
  const isCoach = user != null && !isStaff
  const isReadOnly = isStaff && !isAdmin
  const [showAllRisk, setShowAllRisk] = useState(false)
  const navigate = useNavigate()

  const { data: groups = [], isPending: groupsLoading } = useGroups()
  const { data: season, isPending: seasonLoading } = useCurrentSeason()

  const { data: atRisk = [], isPending: atRiskLoading } = useQuery({
    queryKey: ['at-risk-players'],
    queryFn: () => getAtRiskPlayers().then((r) => (r.data ?? []) as AtRiskPlayer[]),
  })

  const { data: playersData, isPending: playersLoading } = useQuery({
    queryKey: ['dashboard-players'],
    queryFn: () => getPlayers(undefined, 200).then((r) => r.data as { items: Player[]; total: number }),
  })
  const allPlayers = playersData?.items ?? []
  const totalPlayers = playersData?.total ?? null
  const injuredPlayers = allPlayers.filter((p) => p.availability && p.availability !== 'disponibile')

  const { data: sessionsData, isPending: sessionsLoading } = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () =>
      getSessions(null, 5).then((r) => r.data as { items: RecentSession[]; total: number }),
  })
  const recentSessions = sessionsData?.items ?? []
  const totalSessions = sessionsData?.total ?? null

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g])) as Record<string, Group | undefined>
  const myGroup = isCoach ? (groups[0] ?? null) : null

  const seasonLabel = (() => {
    if (!season) return '—'
    if (season.start_date && season.end_date) {
      const y1 = new Date(season.start_date).getFullYear()
      const y2 = new Date(season.end_date).getFullYear()
      return y1 === y2 ? String(y1) : `${y1}/${String(y2).slice(2)}`
    }
    return season.name
  })()

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCoach && myGroup ? myGroup.name : 'Dashboard'}
          </h1>
          {isCoach && myGroup && (
            <p className="text-sm text-gray-500 mt-0.5">Il mio gruppo</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          {isCoach && (
            <Link
              to="/sessions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-granata text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              + Nuova sessione
            </Link>
          )}
          {isReadOnly && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full border border-gray-200">
              Sola lettura
            </span>
          )}
        </div>
      </div>

      {/* Accesso rapido admin */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Gestione utenti', to: '/impostazioni/utenti', desc: 'Attiva, sospendi, assegna ruoli' },
            { label: 'Impostazioni stagione', to: '/impostazioni/stagione', desc: 'Stagione attiva e gruppi' },
            { label: 'Rosa completa', to: '/players', desc: 'Tutti i giocatori registrati' },
          ].map(({ label, to, desc }) => (
            <Link
              key={to}
              to={to}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-granata hover:shadow-sm transition-all"
            >
              <div className="text-sm font-semibold text-gray-800">{label}</div>
              <div className="text-xs text-gray-400 mt-1">{desc}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Stagione" value={seasonLabel} loading={seasonLoading} />
        {isCoach ? (
          <StatCard label="Livello" value={myGroup?.level ?? '—'} loading={groupsLoading} />
        ) : (
          <StatCard label="Gruppi attivi" value={groups.length} loading={groupsLoading} />
        )}
        <StatCard label="Giocatori" value={totalPlayers ?? '—'} loading={playersLoading} />
        <StatCard label="Sessioni totali" value={totalSessions ?? '—'} loading={sessionsLoading} />
      </div>

      {/* At-risk alert */}
      {!atRiskLoading && atRisk.length > 0 && (
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

      {/* Infortuni attivi */}
      {!playersLoading && injuredPlayers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-orange-700 font-semibold text-sm">
              {injuredPlayers.length} {injuredPlayers.length === 1 ? 'giocatore' : 'giocatori'} non disponibili
            </span>
            <Link to="/players" className="text-xs text-orange-600 hover:text-orange-800 font-medium">
              Vedi tutti →
            </Link>
          </div>
          <div className="space-y-2">
            {injuredPlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/players/${p.id}`)}
                className="w-full flex items-center justify-between bg-white border border-orange-100 rounded-lg px-4 py-2.5 text-left hover:border-orange-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {p.last_name} {p.first_name}
                  </span>
                  {p.current_group_name && (
                    <span className="text-xs text-gray-400">{p.current_group_name}</span>
                  )}
                </div>
                <AvailabilityBadge availability={p.availability} />
              </button>
            ))}
          </div>
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

        {sessionsLoading ? (
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[group.level as keyof typeof LEVEL_COLORS] ?? 'bg-gray-100 text-gray-600'}`}>
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
