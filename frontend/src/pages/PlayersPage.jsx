import { useState, useEffect } from 'react'
import { getPlayers, deletePlayer } from '../api/players'
import { getGroups } from '../api/groups'
import PlayerFormModal from '../components/PlayerFormModal'
import { useAuth } from '../context/AuthContext'

export default function PlayersPage() {
  const [players, setPlayers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, player: null })
  const [deleting, setDeleting] = useState(false)
  const { isAdmin } = useAuth()

  const loadPlayers = (groupId) => {
    setLoading(true)
    getPlayers(groupId || undefined)
      .then((res) => {
        const sorted = res.data.sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)
      })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getGroups().then((res) => setGroups(res.data))
    loadPlayers()
  }, [])

  const handleGroupChange = (e) => {
    setSelectedGroup(e.target.value)
    loadPlayers(e.target.value)
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

      <div className="mb-5">
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
      </div>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-gray-900">{p.last_name} {p.first_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.birth_year && `${p.birth_year}`}
                  {p.birth_year && ' · '}
                  {p.current_group_name || '—'}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditPlayer(p)}
                    className="text-gray-400 hover:text-granata transition-colors text-lg leading-none"
                    title="Modifica giocatore"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ open: true, player: p })}
                    className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                    title="Rimuovi giocatore"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
          {!players.length && (
            <div className="text-center text-gray-400 py-8 text-sm">
              Nessun giocatore trovato
            </div>
          )}
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
