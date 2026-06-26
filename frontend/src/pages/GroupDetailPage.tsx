import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getGroup, updateGroupTargets, getGroupChangelog, getGroupAttendance, getGroupPlayerStats, getGroupHistory } from '../api/groups'
import { getSessions } from '../api/sessions'
import { deletePlayer } from '../api/players'
import PlayerFormModal from '../components/PlayerFormModal'
import { Pencil, Trash2 } from 'lucide-react'
import { LEVEL_COLORS, COGNITIVE_PARAMS } from '../constants/domain'
import { useAuth } from '../context/AuthContext'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const PARAMS = COGNITIVE_PARAMS.map((p) => p.label)

const FIELD_LABELS = {
  level: 'Livello',
  category: 'Categoria',
  birth_year: 'Anno di nascita',
  sub_group: 'Sottogruppo',
  max_players: 'Max giocatori',
  name: 'Nome',
}

const SESSION_TYPE_SHORT = { training: 'All', match: 'Par', test: 'Test' }

function AttendanceGrid({ data, loading, limit, onLimitChange }) {
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
  const lookup = {}
  for (const r of records) {
    const pid = String(r.player_id)
    if (!lookup[pid]) lookup[pid] = {}
    lookup[pid][String(r.session_id)] = r.is_absent
  }

  const pct = (n, d) => d === 0 ? '—' : `${Math.round((n / d) * 100)}%`

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

const HISTORY_COLORS = { SR: '#3b82f6', DQI: '#10b981', AI: '#f59e0b', TRS: '#8b5cf6', VCI: '#ef4444' }

function GroupHistoryChart({ history, loading }) {
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
            formatter={(v) => v != null ? v.toFixed(2) : '—'}
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
const METRICS = [
  { key: 'avg_sr',  label: 'SR'  },
  { key: 'avg_dqi', label: 'DQI' },
  { key: 'avg_ai',  label: 'AI'  },
  { key: 'avg_trs', label: 'TRS' },
  { key: 'avg_vci', label: 'VCI' },
]

function ComparisonView({ stats, loading, selected, onToggle }) {
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
    const entry = { metric: label }
    selectedStats.forEach((p) => {
      entry[`${p.last_name} ${p.first_name}`] = p[key] !== null ? +p[key].toFixed(2) : null
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
                  formatter={(v) => v !== null ? v.toFixed(2) : '—'}
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
                  const values = selectedStats.map((p) => p[key])
                  const max = Math.max(...values.filter((v) => v !== null))
                  return (
                    <tr key={key}>
                      <td className="px-4 py-2.5 font-semibold text-gray-700 text-xs">{label}</td>
                      {selectedStats.map((p) => {
                        const v = p[key]
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

function ChangelogTimeline({ entries, loading }) {
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
  const [group, setGroup] = useState(null)
  const [players, setPlayers] = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editingTargets, setEditingTargets] = useState(false)
  const [targetEdits, setTargetEdits] = useState([])
  const [saving, setSaving] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, player: null })
  const [deleting, setDeleting] = useState(false)
  const [changelog, setChangelog] = useState([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [attendance, setAttendance] = useState(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceLimit, setAttendanceLimit] = useState(20)
  const [playerStats, setPlayerStats] = useState([])
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [groupSessions, setGroupSessions] = useState([])
  const [groupSessionsLoading, setGroupSessionsLoading] = useState(false)
  const { isAdmin } = useAuth()

  const load = () => {
    setLoading(true)
    getGroup(id)
      .then((res) => {
        setGroup(res.data)
        const sorted = (res.data.players ?? []).sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)
        setTargets(res.data.targets ?? [])
        setTargetEdits(res.data.targets ?? [])
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
    Promise.all([getGroupChangelog(id), getGroupHistory(id, 60)])
      .then(([clRes, histRes]) => {
        setChangelog(clRes.data)
        setHistory(histRes.data)
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
    getGroupAttendance(id, attendanceLimit)
      .then((res) => setAttendance(res.data))
      .catch(() => {})
      .finally(() => setAttendanceLoading(false))
  }, [activeTab, id, attendanceLimit])

  useEffect(() => {
    if (activeTab !== 'confronto') return
    if (playerStats.length) return
    setPlayerStatsLoading(true)
    getGroupPlayerStats(id)
      .then((res) => { setPlayerStats(res.data); setSelectedPlayers(res.data.slice(0, 2).map((p) => p.player_id)) })
      .catch(() => {})
      .finally(() => setPlayerStatsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'sessioni') return
    setGroupSessionsLoading(true)
    getSessions(id, 200)
      .then((res) => setGroupSessions(res.data.items ?? []))
      .catch(() => {})
      .finally(() => setGroupSessionsLoading(false))
  }, [activeTab, id])

  const handleSaveTargets = async () => {
    setSaving(true)
    try {
      await updateGroupTargets(id, targetEdits)
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
      await deletePlayer(deleteConfirm.player.id)
      setDeleteConfirm({ open: false, player: null })
      load()
    } catch {
      setError('Errore durante la rimozione')
    } finally {
      setDeleting(false)
    }
  }

  const updateTargetField = (param, field, value) => {
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
                  <strong>{deleteConfirm.player.last_name} {deleteConfirm.player.first_name}</strong>?
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
