import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGroup, updateGroupTargets, getGroupChangelog } from '../api/groups'
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
