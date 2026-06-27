import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getGroup, updateGroupTargets, getGroupChangelog, getGroupAttendance, getGroupPlayerStats, getGroupHistory } from '../api/groups'
import { getSessions } from '../api/sessions'
import { listMatches, getScorers } from '../api/matches'
import { deletePlayer } from '../api/players'
import PlayerFormModal from '../components/PlayerFormModal'
import { Pencil, Trash2 } from 'lucide-react'
import { LEVEL_COLORS, COGNITIVE_PARAMS, METRIC_COLORS_BY_TYPE } from '../constants/domain'
import { useAuth } from '../context/AuthContext'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { GroupDetail, PlayerInGroup, Target, GroupHistoryItem, GroupChangeLog, PlayerStats, Session, Match, Scorer } from '../types/api'

type AttendanceData = {
  sessions: Array<{ id: string; session_date: string; session_type: string }>
  players: Array<{ id: string; first_name: string; last_name: string }>
  records: Array<{ player_id: string; session_id: string; is_absent: boolean }>
}

const PARAMS = COGNITIVE_PARAMS.map((p) => p.label)

const FIELD_LABELS: Record<string, string> = {
  level: 'Livello',
  category: 'Categoria',
  birth_year: 'Anno di nascita',
  sub_group: 'Sottogruppo',
  max_players: 'Max giocatori',
  name: 'Nome',
}

const SESSION_TYPE_SHORT: Record<string, string> = { training: 'All', match: 'Par', test: 'Test' }

function AttendanceGrid({ data, loading, limit, onLimitChange }: {
  data: AttendanceData | null
  loading: boolean
  limit: number
  onLimitChange: (n: number) => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  const sessions = data?.sessions ?? []
  const players = data?.players ?? []
  const records = data?.records ?? []

  // Build lookup: playerIdStr -> sessionIdStr -> is_absent
  const lookup: Record<string, Record<string, boolean>> = {}
  for (const r of records) {
    const pid = String(r.player_id)
    if (!lookup[pid]) lookup[pid] = {}
    lookup[pid][String(r.session_id)] = r.is_absent
  }

  const pct = (n: number, d: number) => d === 0 ? '—' : `${Math.round((n / d) * 100)}%`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {players.length} giocatori · {sessions.length} sessioni
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-granata"
        >
          {[10, 20, 30, 60].map((n) => (
            <option key={n} value={n}>Ultime {n}</option>
          ))}
        </select>
      </div>

      {!sessions.length ? (
        <div className="text-center text-gray-400 py-12 text-sm">Nessuna sessione registrata</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="text-xs border-collapse" style={{ minWidth: `${sessions.length * 44 + 180}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 bg-gray-50 text-left px-3 py-2.5 text-gray-600 font-medium min-w-[160px] z-10 border-r border-gray-200">
                  Giocatore
                </th>
                {sessions.map((s) => {
                  const d = new Date(s.session_date)
                  return (
                    <th key={s.id} className="px-1.5 py-2 text-center text-gray-500 font-medium min-w-[40px]">
                      <div>{d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</div>
                      <div className="text-gray-400 font-normal">{SESSION_TYPE_SHORT[s.session_type] ?? s.session_type}</div>
                    </th>
                  )
                })}
                <th className="px-2 py-2.5 text-center text-gray-600 font-medium min-w-[52px] border-l border-gray-200">
                  % pres.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p) => {
                const pid = String(p.id)
                let present = 0
                let total = 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-2 border-r border-gray-200 z-10">
                      <Link to={`/players/${p.id}`} className="font-medium text-gray-800 hover:opacity-70 transition-opacity">
                        {p.last_name} {p.first_name}
                      </Link>
                    </td>
                    {sessions.map((s) => {
                      const sid = String(s.id)
                      const record = lookup[pid]?.[sid]
                      if (record === undefined) {
                        return <td key={s.id} className="px-1 py-2 text-center text-gray-300">—</td>
                      }
                      total++
                      const isPresent = !record
                      if (isPresent) present++
                      return (
                        <td key={s.id} className="px-1 py-2 text-center">
                          {isPresent
                            ? <span className="text-green-600 font-bold">✓</span>
                            : <span className="text-red-500 font-bold">✗</span>
                          }
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center font-semibold border-l border-gray-200 text-gray-700">
                      {pct(present, total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="sticky left-0 bg-gray-50 px-3 py-2 text-gray-500 font-medium border-r border-gray-200 z-10">
                  % presenze
                </td>
                {sessions.map((s) => {
                  const sid = String(s.id)
                  let present = 0, total = 0
                  for (const p of players) {
                    const record = lookup[String(p.id)]?.[sid]
                    if (record !== undefined) { total++; if (!record) present++ }
                  }
                  const p = total === 0 ? null : Math.round((present / total) * 100)
                  return (
                    <td key={s.id} className="px-1 py-2 text-center font-semibold" style={{
                      color: p === null ? '#9ca3af' : p >= 80 ? '#16a34a' : p >= 60 ? '#d97706' : '#dc2626'
                    }}>
                      {p === null ? '—' : `${p}%`}
                    </td>
                  )
                })}
                <td className="border-l border-gray-200" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

const COMPARISON_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#6366f1',
]

const HISTORY_COLORS = METRIC_COLORS_BY_TYPE

function GroupHistoryChart({ history, loading }: { history: GroupHistoryItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }
  if (!history.length) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm bg-white rounded-xl border border-gray-200">
        Nessun dato di sessione disponibile
      </div>
    )
  }
  const lineData = history.map((h) => ({
    date: new Date(h.session_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
    SR: h.avg_sr != null ? +h.avg_sr.toFixed(2) : null,
    DQI: h.avg_dqi != null ? +h.avg_dqi.toFixed(2) : null,
    AI: h.avg_ai != null ? +h.avg_ai.toFixed(2) : null,
    TRS: h.avg_trs != null ? +h.avg_trs.toFixed(2) : null,
    VCI: h.avg_vci != null ? +h.avg_vci.toFixed(2) : null,
  }))
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="text-sm font-semibold text-gray-700 mb-3">Andamento sessioni</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={lineData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v) => typeof v === 'number' ? v.toFixed(2) : '—'}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(HISTORY_COLORS).map(([key, color]) => (
            <Line key={key} type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
const METRICS = COGNITIVE_PARAMS.map((p) => ({ key: p.avgKey, label: p.label }))

function ComparisonView({ stats, loading, selected, onToggle }: {
  stats: PlayerStats[]
  loading: boolean
  selected: string[]
  onToggle: (playerId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }
  if (!stats.length) {
    return <div className="text-center text-gray-400 py-12 text-sm">Nessun dato disponibile</div>
  }

  const selectedStats = stats.filter((p) => selected.includes(p.player_id))

  const radarData = METRICS.map(({ key, label }) => {
    const entry: Record<string, string | number | null> = { metric: label }
    selectedStats.forEach((p) => {
      const val = (p as unknown as Record<string, number | null>)[key]
      entry[`${p.last_name} ${p.first_name}`] = val !== null && val != null ? +val.toFixed(2) : null
    })
    return entry
  })

  return (
    <div className="space-y-5">
      {/* Player selector */}
      <div>
        <div className="text-xs text-gray-500 mb-2">Seleziona i giocatori da confrontare</div>
        <div className="flex flex-wrap gap-2">
          {stats.map((p) => {
            const isSelected = selected.includes(p.player_id)
            const colorIdx = selected.indexOf(p.player_id)
            const color = COMPARISON_COLORS[colorIdx % COMPARISON_COLORS.length]
            return (
              <button
                key={p.player_id}
                onClick={() => onToggle(p.player_id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={isSelected ? {
                  backgroundColor: color,
                  borderColor: color,
                  color: '#fff',
                } : {
                  backgroundColor: '#fff',
                  borderColor: '#d1d5db',
                  color: '#6b7280',
                }}
              >
                {p.last_name} {p.first_name}
                <span className="ml-1.5 opacity-70">({p.session_count} ses.)</span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedStats.length < 2 ? (
        <div className="text-center text-gray-400 py-8 text-sm">Seleziona almeno 2 giocatori</div>
      ) : (
        <>
          {/* Radar chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => typeof v === 'number' ? v.toFixed(2) : '—'}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {selectedStats.map((p, i) => {
                  const color = COMPARISON_COLORS[i % COMPARISON_COLORS.length]
                  return (
                    <Radar
                      key={p.player_id}
                      name={`${p.last_name} ${p.first_name}`}
                      dataKey={`${p.last_name} ${p.first_name}`}
                      fill={color}
                      fillOpacity={0.15}
                      stroke={color}
                      strokeWidth={2}
                    />
                  )
                })}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-gray-600 font-medium text-xs">Metrica</th>
                  {selectedStats.map((p, i) => (
                    <th key={p.player_id} className="text-center px-3 py-2.5 text-xs font-medium" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>
                      {p.last_name} {p.first_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {METRICS.map(({ key, label }) => {
                  const values = selectedStats.map((p) => (p as unknown as Record<string, number | null>)[key])
                  const max = Math.max(...values.filter((v): v is number => v !== null))
                  return (
                    <tr key={key}>
                      <td className="px-4 py-2.5 font-semibold text-gray-700 text-xs">{label}</td>
                      {selectedStats.map((p) => {
                        const v = (p as unknown as Record<string, number | null>)[key]
                        const isTop = v !== null && v === max && selectedStats.length > 1
                        return (
                          <td key={p.player_id} className="px-3 py-2.5 text-center">
                            <span className={`text-sm font-medium ${isTop ? 'text-green-600' : 'text-gray-800'}`}>
                              {v !== null ? v.toFixed(2) : '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ChangelogTimeline({ entries, loading }: { entries: GroupChangeLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="text-center text-gray-400 py-12 text-sm">
        Nessuna modifica registrata
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative">
            <div className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full bg-granata border-2 border-white" />
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-granata uppercase tracking-wide">
                  {FIELD_LABELS[entry.field] ?? entry.field}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(entry.changed_at).toLocaleDateString('it-IT', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 line-through">{entry.old_value ?? '—'}</span>
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-gray-900">{entry.new_value ?? '—'}</span>
              </div>
              {entry.changed_by && (
                <div className="text-xs text-gray-400 mt-1">da {entry.changed_by}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('players')
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [players, setPlayers] = useState<PlayerInGroup[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editingTargets, setEditingTargets] = useState(false)
  const [targetEdits, setTargetEdits] = useState<Target[]>([])
  const [saving, setSaving] = useState(false)
  const [editPlayer, setEditPlayer] = useState<PlayerInGroup | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; player: PlayerInGroup | null }>({ open: false, player: null })
  const [deleting, setDeleting] = useState(false)
  const [changelog, setChangelog] = useState<GroupChangeLog[]>([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [history, setHistory] = useState<GroupHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceLimit, setAttendanceLimit] = useState(20)
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [groupSessions, setGroupSessions] = useState<Session[]>([])
  const [groupSessionsLoading, setGroupSessionsLoading] = useState(false)
  const [groupMatches, setGroupMatches] = useState<Match[]>([])
  const [groupMatchesLoading, setGroupMatchesLoading] = useState(false)
  const [groupScorers, setGroupScorers] = useState<Scorer[]>([])
  const { isAdmin } = useAuth()

  const load = () => {
    setLoading(true)
    getGroup(id!)
      .then((res) => {
        const g = res.data as GroupDetail
        setGroup(g)
        const sorted = (g.players ?? []).sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)
        setTargets(g.targets ?? [])
        setTargetEdits(g.targets ?? [])
      })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (activeTab !== 'sviluppo') return
    setChangelogLoading(true)
    setHistoryLoading(true)
    Promise.all([getGroupChangelog(id!), getGroupHistory(id!, 60)])
      .then(([clRes, histRes]) => {
        setChangelog(clRes.data as GroupChangeLog[])
        setHistory(histRes.data as GroupHistoryItem[])
      })
      .catch(() => {})
      .finally(() => {
        setChangelogLoading(false)
        setHistoryLoading(false)
      })
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'presenze') return
    setAttendanceLoading(true)
    getGroupAttendance(id!, attendanceLimit)
      .then((res) => setAttendance(res.data as AttendanceData))
      .catch(() => {})
      .finally(() => setAttendanceLoading(false))
  }, [activeTab, id, attendanceLimit])

  useEffect(() => {
    if (activeTab !== 'confronto') return
    if (playerStats.length) return
    setPlayerStatsLoading(true)
    getGroupPlayerStats(id!)
      .then((res) => {
        const ps = res.data as PlayerStats[]
        setPlayerStats(ps)
        setSelectedPlayers(ps.slice(0, 2).map((p) => p.player_id))
      })
      .catch(() => {})
      .finally(() => setPlayerStatsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'sessioni') return
    setGroupSessionsLoading(true)
    getSessions(id!, 200)
      .then((res) => setGroupSessions((res.data.items ?? []) as Session[]))
      .catch(() => {})
      .finally(() => setGroupSessionsLoading(false))
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'partite') return
    setGroupMatchesLoading(true)
    Promise.all([
      listMatches({ group_id: id }),
      getScorers({ group_id: id! }),
    ])
      .then(([matchRes, scorersRes]) => {
        setGroupMatches(matchRes.data as Match[])
        setGroupScorers(scorersRes.data as Scorer[])
      })
      .catch(() => {})
      .finally(() => setGroupMatchesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id])

  const handleSaveTargets = async () => {
    setSaving(true)
    try {
      await updateGroupTargets(id!, targetEdits)
      setTargets(targetEdits)
      setEditingTargets(false)
    } catch {
      setError('Errore nel salvataggio dei target')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlayer = async () => {
    setDeleting(true)
    try {
      await deletePlayer(deleteConfirm.player!.id)
      setDeleteConfirm({ open: false, player: null })
      load()
    } catch {
      setError('Errore durante la rimozione')
    } finally {
      setDeleting(false)
    }
  }

  const updateTargetField = (param: string, field: keyof Target, value: string) => {
    setTargetEdits((prev) =>
      prev.map((t) =>
        t.parameter === param ? { ...t, [field]: parseFloat(value) || 0 } : t
      )
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!group) {
    return <div className="text-red-600 text-sm">{error || 'Gruppo non trovato'}</div>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/groups')}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_COLORS[group.level] ?? 'bg-gray-100 text-gray-600'}`}>
          {group.level}
        </span>
      </div>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'players', label: 'Giocatori' },
          { key: 'targets', label: 'Target' },
          { key: 'sessioni', label: 'Sessioni' },
          { key: 'partite', label: 'Partite' },
          { key: 'sviluppo', label: 'Sviluppo' },
          { key: 'presenze', label: 'Presenze' },
          { key: 'confronto', label: 'Confronto' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-granata text-granata'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {activeTab === 'players' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{players.length} giocatori</span>
            {isAdmin && (
              <button
                onClick={() => setShowAddPlayer(true)}
                className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
              >
                + Aggiungi giocatore
              </button>
            )}
          </div>

          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
              >
                <Link
                  to={`/players/${p.id}`}
                  className="flex-1 min-w-0 hover:opacity-70 transition-opacity"
                >
                  <div className="font-medium text-gray-900">{p.last_name} {p.first_name}</div>
                  {p.birth_year && (
                    <div className="text-xs text-gray-500 mt-0.5">Anno: {p.birth_year}</div>
                  )}
                </Link>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditPlayer(p)}
                      className="p-1 text-gray-400 hover:text-granata transition-colors"
                      title="Modifica giocatore"
                    >
                      <Pencil size={15} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, player: p })}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Rimuovi giocatore"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!players.length && (
              <div className="text-center text-gray-400 py-8 text-sm">
                Nessun giocatore assegnato
              </div>
            )}
          </div>

          <PlayerFormModal
            isOpen={showAddPlayer}
            onClose={() => setShowAddPlayer(false)}
            onSuccess={() => load()}
            preselectedGroupId={id}
            preselectedGroupName={group.name}
          />

          <PlayerFormModal
            isOpen={!!editPlayer}
            onClose={() => setEditPlayer(null)}
            onSuccess={() => load()}
            mode="edit"
            player={editPlayer}
          />

          {deleteConfirm.open && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                <p className="text-sm text-gray-700 mb-4">
                  Sei sicuro di voler rimuovere{' '}
                  <strong>{deleteConfirm.player?.last_name} {deleteConfirm.player?.first_name}</strong>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm({ open: false, player: null })}
                    disabled={deleting}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDeletePlayer}
                    disabled={deleting}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting ? 'Rimozione…' : 'Rimuovi'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sviluppo tab */}
      {activeTab === 'sviluppo' && (
        <div>
          <GroupHistoryChart history={history} loading={historyLoading} />
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Modifiche gruppo</div>
          <ChangelogTimeline entries={changelog} loading={changelogLoading} />
        </div>
      )}

      {/* Presenze tab */}
      {activeTab === 'presenze' && (
        <AttendanceGrid
          data={attendance}
          loading={attendanceLoading}
          limit={attendanceLimit}
          onLimitChange={setAttendanceLimit}
        />
      )}

      {/* Partite tab */}
      {activeTab === 'partite' && (
        <div>
          {groupMatchesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Record */}
              {groupMatches.filter((m) => m.score_home != null).length > 0 && (() => {
                const played = groupMatches.filter((m) => m.score_home != null && m.score_away != null)
                const wins = played.filter((m) => (m.score_home ?? 0) > (m.score_away ?? 0)).length
                const draws = played.filter((m) => m.score_home === m.score_away).length
                const losses = played.length - wins - draws
                const gf = played.reduce((s, m) => s + (m.score_home ?? 0), 0)
                const ga = played.reduce((s, m) => s + (m.score_away ?? 0), 0)
                return (
                  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-green-700 text-lg">{wins}V</span>
                        <span className="text-gray-300">·</span>
                        <span className="font-bold text-yellow-600 text-lg">{draws}P</span>
                        <span className="text-gray-300">·</span>
                        <span className="font-bold text-red-600 text-lg">{losses}S</span>
                      </div>
                      <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                      <div className="text-sm text-gray-600">
                        Gol <span className="font-semibold text-gray-900">{gf}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="font-semibold text-gray-900">{ga}</span>
                      </div>
                      <div className="ml-auto text-xs text-gray-400">{played.length} partite giocate</div>
                    </div>
                  </div>
                )
              })()}

              {/* Match list */}
              {groupMatches.length > 0 ? (
                <div className="space-y-2">
                  {groupMatches.map((m) => {
                    const hasResult = m.score_home != null && m.score_away != null
                    const diff = hasResult ? (m.score_home ?? 0) - (m.score_away ?? 0) : null
                    const chip = diff == null ? null
                      : diff > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">V</span>
                      : diff < 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">S</span>
                      : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">P</span>
                    return (
                      <button
                        key={m.id}
                        onClick={() => navigate(`/partite/${m.id}`)}
                        className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-granata/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{m.opponent}</span>
                          <div className="flex items-center gap-2">
                            {hasResult && (
                              <span className="text-sm font-bold text-gray-900">{m.score_home} – {m.score_away}</span>
                            )}
                            {chip}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(m.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' · '}{m.home_away === 'home' ? 'Casa' : m.home_away === 'away' ? 'Trasferta' : 'Neutro'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-12 text-sm">Nessuna partita registrata</div>
              )}

              {/* Scorers */}
              {groupScorers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Marcatori</div>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {groupScorers.map((s, i) => (
                      <div key={s.player_id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-900">{s.last_name} {s.first_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 shrink-0">
                          <span>⚽ <strong>{s.goals}</strong></span>
                          {s.assists > 0 && <span>🅰 {s.assists}</span>}
                          <span className="text-gray-400">{s.matches_played}p</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confronto tab */}
      {activeTab === 'confronto' && (
        <ComparisonView
          stats={playerStats}
          loading={playerStatsLoading}
          selected={selectedPlayers}
          onToggle={(id) => setSelectedPlayers((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )}
        />
      )}

      {/* Sessioni tab */}
      {activeTab === 'sessioni' && (
        <div>
          {groupSessionsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {groupSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-granata hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {new Date(s.session_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.session_type}{s.duration_min ? ` · ${s.duration_min} min` : ''}
                      </div>
                      {s.notes && (
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{s.notes}</div>
                      )}
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                </button>
              ))}
              {!groupSessions.length && (
                <div className="text-center text-gray-400 py-12 text-sm">
                  Nessuna sessione registrata
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Targets tab */}
      {activeTab === 'targets' && (
        <div>
          {isAdmin && (
            <div className="flex justify-end mb-4">
              {editingTargets ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingTargets(false); setTargetEdits(targets) }}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSaveTargets}
                    disabled={saving}
                    className="bg-granata text-white px-4 py-2 rounded-lg text-sm hover:bg-granata-dark disabled:opacity-60"
                  >
                    {saving ? 'Salvataggio…' : 'Salva target'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingTargets(true)}
                  className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark"
                >
                  Modifica target
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Parametro</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Insuff. (max)</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Ottimo (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PARAMS.map((param) => {
                  const t = targets.find((x) => x.parameter === param)
                  const te = targetEdits.find((x) => x.parameter === param)
                  return (
                    <tr key={param}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{param}</td>
                      <td className="px-4 py-3 text-center">
                        {editingTargets ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="0.5"
                            value={te?.insufficient_max ?? ''}
                            onChange={(e) => updateTargetField(param, 'insufficient_max', e.target.value)}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                          />
                        ) : (
                          <span className="text-red-600 font-medium">{t?.insufficient_max ?? '–'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingTargets ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="0.5"
                            value={te?.ottimo_min ?? ''}
                            onChange={(e) => updateTargetField(param, 'ottimo_min', e.target.value)}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                          />
                        ) : (
                          <span className="text-green-600 font-medium">{t?.ottimo_min ?? '–'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
