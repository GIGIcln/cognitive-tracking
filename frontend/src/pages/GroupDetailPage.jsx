import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGroup, updateGroupTargets, getGroupChangelog, getGroupAttendance } from '../api/groups'
import { deletePlayer } from '../api/players'
import PlayerFormModal from '../components/PlayerFormModal'
import { Pencil, Trash2 } from 'lucide-react'
import { LEVEL_COLORS } from '../constants/domain'
import { useAuth } from '../context/AuthContext'

const PARAMS = ['SR', 'DQI', 'AI', 'TRS', 'VCI']

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
                    <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-2 font-medium text-gray-800 border-r border-gray-200 z-10">
                      {p.last_name} {p.first_name}
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
  const [attendance, setAttendance] = useState(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceLimit, setAttendanceLimit] = useState(20)
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

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (activeTab !== 'sviluppo') return
    setChangelogLoading(true)
    getGroupChangelog(id)
      .then((res) => setChangelog(res.data))
      .catch(() => {})
      .finally(() => setChangelogLoading(false))
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'presenze') return
    setAttendanceLoading(true)
    getGroupAttendance(id, attendanceLimit)
      .then((res) => setAttendance(res.data))
      .catch(() => {})
      .finally(() => setAttendanceLoading(false))
  }, [activeTab, id, attendanceLimit])

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
          { key: 'sviluppo', label: 'Sviluppo' },
          { key: 'presenze', label: 'Presenze' },
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
                <div>
                  <div className="font-medium text-gray-900">{p.last_name} {p.first_name}</div>
                  {p.birth_year && (
                    <div className="text-xs text-gray-500 mt-0.5">Anno: {p.birth_year}</div>
                  )}
                </div>
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
        <ChangelogTimeline entries={changelog} loading={changelogLoading} />
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
