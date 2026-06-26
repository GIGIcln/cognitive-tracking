import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlayers, deletePlayer, bulkAssignPlayers } from '../api/players'
import PlayerFormModal from '../components/PlayerFormModal'
import AvailabilityBadge from '../components/AvailabilityBadge'
import { useAuth } from '../context/AuthContext'
import { useSeasonGroup } from '../context/SeasonGroupContext'
import { Pencil, Trash2 } from 'lucide-react'

export default function PlayersPage() {
  const [players, setPlayers] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, player: null })
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [targetGroup, setTargetGroup] = useState('')
  const [assigning, setAssigning] = useState(false)
  const { isAdmin } = useAuth()
  const { groups } = useSeasonGroup()
  const navigate = useNavigate()

  const loadPlayers = (groupId) => {
    setLoading(true)
    getPlayers(groupId || undefined)
      .then((res) => {
        const sorted = res.data.items.sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)
      })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPlayers()
  }, [])

  const handleGroupChange = (e) => {
    setSelectedGroup(e.target.value)
    setQuery('')
    loadPlayers(e.target.value)
  }

  const filtered = players.filter((p) => {
    const q = query.toLowerCase()
    return p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q)
  })

  const handleBulkAssign = async () => {
    if (!targetGroup || selected.size === 0) return
    setAssigning(true)
    try {
      await bulkAssignPlayers([...selected], targetGroup)
      setSelected(new Set())
      setTargetGroup('')
      loadPlayers(selectedGroup)
    } catch {
      setError('Errore durante lo spostamento')
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePlayer(deleteConfirm.player.id)
      setDeleteConfirm({ open: false, player: null })
      loadPlayers(selectedGroup)
    } catch {
      setError('Errore durante la rimozione')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Giocatori</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
          >
            + Nuovo giocatore
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <select
          value={selectedGroup}
          onChange={handleGroupChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
        >
          <option value="">Tutti i gruppi</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Cerca giocatore…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-granata"
        />
      </div>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : (
        <div className={`space-y-2 ${selected.size > 0 ? 'pb-24' : ''}`}>
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between hover:border-granata hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(`/players/${p.id}`)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {isAdmin && (
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(p.id); else next.delete(p.id)
                        return next
                      })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-granata w-4 h-4 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{p.last_name} {p.first_name}</span>
                    {p.position && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                        {p.position}
                      </span>
                    )}
                    <AvailabilityBadge availability={p.availability} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.birth_year && `${p.birth_year}`}
                    {p.birth_year && ' · '}
                    {p.current_group_name || '—'}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
          {!filtered.length && (
            <div className="text-center text-gray-400 py-8 text-sm">
              {query ? `Nessun risultato per "${query}"` : 'Nessun giocatore trovato'}
            </div>
          )}
        </div>
      )}

      {isAdmin && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-gray-200 p-3 flex items-center gap-3 z-30 shadow-lg">
          <span className="text-sm text-gray-600 shrink-0">
            {selected.size} giocator{selected.size === 1 ? 'e' : 'i'} selezionat{selected.size === 1 ? 'o' : 'i'}
          </span>
          <select
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
          >
            <option value="">Sposta in gruppo…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!targetGroup || assigning}
            className="bg-granata text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {assigning ? 'Spostando…' : 'Sposta'}
          </button>
          <button
            onClick={() => { setSelected(new Set()); setTargetGroup('') }}
            className="text-gray-400 hover:text-gray-600 text-sm px-2"
          >
            ✕
          </button>
        </div>
      )}

      <PlayerFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => loadPlayers(selectedGroup)}
        preselectedGroupId={null}
        preselectedGroupName={null}
      />

      <PlayerFormModal
        isOpen={!!editPlayer}
        onClose={() => setEditPlayer(null)}
        onSuccess={() => loadPlayers(selectedGroup)}
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
                onClick={handleDelete}
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
  )
}
