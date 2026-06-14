import { useState, useEffect } from 'react'
import { getPlayers, createPlayer, updatePlayer } from '../api/players'
import { getGroups } from '../api/groups'

const EMPTY_FORM = { first_name: '', last_name: '', birth_year: '', notes: '' }

export default function PlayersPage() {
  const [players, setPlayers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadPlayers = (groupId) => {
    setLoading(true)
    getPlayers(groupId || undefined)
      .then((res) => setPlayers(res.data))
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

  const openCreate = () => {
    setEditingPlayer(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditingPlayer(p)
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      birth_year: p.birth_year ?? '',
      notes: p.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, birth_year: parseInt(form.birth_year) }
      if (editingPlayer) {
        await updatePlayer(editingPlayer.id, payload)
      } else {
        await createPlayer(payload)
      }
      setShowModal(false)
      loadPlayers(selectedGroup)
    } catch {
      setError('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const groupName = (gId) => groups.find((g) => g.id === gId)?.name

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Giocatori</h1>
        <button
          onClick={openCreate}
          className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
        >
          + Nuovo giocatore
        </button>
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

      {error && !showModal && <div className="text-red-600 text-sm mb-4">{error}</div>}

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
                <div className="font-medium text-gray-900">{p.first_name} {p.last_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.birth_year && `Nato nel ${p.birth_year}`}
                  {selectedGroup && groups.find(g => g.id === selectedGroup) && (
                    <> · {groupName(selectedGroup)}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => openEdit(p)}
                className="text-sm text-granata hover:underline"
              >
                Modifica
              </button>
            </div>
          ))}
          {!players.length && (
            <div className="text-center text-gray-400 py-8 text-sm">
              Nessun giocatore trovato
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingPlayer ? 'Modifica giocatore' : 'Nuovo giocatore'}
            </h3>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3 border border-red-200">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                placeholder="Nome"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
              <input
                placeholder="Cognome"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
              <input
                placeholder="Anno di nascita"
                type="number"
                min="2000"
                max="2025"
                value={form.birth_year}
                onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
              <textarea
                placeholder="Note (opzionale)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                rows={2}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-granata text-white py-2 rounded-lg text-sm hover:bg-granata-dark disabled:opacity-60"
                >
                  {saving ? 'Salvataggio…' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
