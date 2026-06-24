import { useState, useEffect } from 'react'
import { createPlayer, updatePlayer, assignPlayer } from '../api/players'
import { getGroups } from '../api/groups'
import { POSITIONS, FOOT_OPTIONS } from '../constants/domain'

const EMPTY_FORM = {
  first_name: '', last_name: '', birth_year: '', position: '',
  nationality: '', foot: '', jersey_number: '', phone: '', notes: '', group_id: '',
}

export default function PlayerFormModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedGroupId = null,
  preselectedGroupName = null,
  player = null,
  mode = 'create',
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [groups, setGroups] = useState([])
  const [originalGroupId, setOriginalGroupId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (mode === 'edit' && player) {
      getGroups()
        .then((res) => {
          const loaded = res.data
          setGroups(loaded)
          const current = player.current_group_name
            ? loaded.find((g) => g.name === player.current_group_name)
            : null
          const currentId = current?.id ?? ''
          setOriginalGroupId(currentId)
          setForm({
            first_name: player.first_name ?? '',
            last_name: player.last_name ?? '',
            birth_year: player.birth_year ?? '',
            position: player.position ?? '',
            nationality: player.nationality ?? '',
            foot: player.foot ?? '',
            jersey_number: player.jersey_number ?? '',
            phone: player.phone ?? '',
            notes: player.notes ?? '',
            group_id: currentId,
          })
        })
        .catch(() => {})
    } else {
      setForm(EMPTY_FORM)
      setOriginalGroupId('')
      if (!preselectedGroupId) {
        getGroups().then((res) => setGroups(res.data)).catch(() => {})
      }
    }
  }, [isOpen, mode, player, preselectedGroupId])

  const isEdit = mode === 'edit'
  const groupChanged = isEdit && form.group_id !== originalGroupId && form.group_id !== ''
  const newGroupName = groups.find((g) => g.id === form.group_id)?.name

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isEdit) {
        await updatePlayer(player.id, {
          first_name: form.first_name,
          last_name: form.last_name,
          birth_year: parseInt(form.birth_year),
          position: form.position || null,
          nationality: form.nationality || null,
          foot: form.foot || null,
          jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
          phone: form.phone || null,
          notes: form.notes || null,
        })
        if (groupChanged) {
          try {
            await assignPlayer(player.id, form.group_id)
          } catch {
            setError('Dati aggiornati ma cambio categoria fallito. Riprova.')
            onSuccess()
            setLoading(false)
            return
          }
        }
      } else {
        await createPlayer({
          first_name: form.first_name,
          last_name: form.last_name,
          birth_year: parseInt(form.birth_year),
          position: form.position || null,
          nationality: form.nationality || null,
          foot: form.foot || null,
          jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
          phone: form.phone || null,
          notes: form.notes || null,
          group_id: preselectedGroupId || form.group_id || null,
        })
      }
      onSuccess()
      onClose()
    } catch (err) {
      if (err?.isOfflineQueued) {
        setError('Connessione assente — operazione accodata. Sincronizzazione automatica al ripristino.')
      } else {
        const detail = err?.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Errore nel salvataggio. Controlla la connessione.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? 'Modifica giocatore' : 'Nuovo giocatore'}
        </h3>
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3 border border-red-200">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Cognome"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
          />
          <input
            placeholder="Nome"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
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
          <select
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
          >
            <option value="">Posizione (opzionale)</option>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Nazionalità (opz.)"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            />
            <input
              placeholder="N° maglia (opz.)"
              type="number"
              min="1"
              max="99"
              value={form.jersey_number}
              onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.foot}
              onChange={(e) => setForm({ ...form, foot: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            >
              <option value="">Piede (opz.)</option>
              {FOOT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <input
              placeholder="Telefono (opz.)"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            />
          </div>
          <textarea
            placeholder="Note (opzionale)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
            rows={2}
          />

          {isEdit ? (
            <div className="space-y-2">
              <select
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              >
                <option value="">Nessuna categoria</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {groupChanged && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-2.5 rounded-lg">
                  ⚠ Il giocatore verrà spostato in <strong>{newGroupName}</strong>.
                  Lo storico delle sessioni precedenti resterà invariato.
                </div>
              )}
            </div>
          ) : (
            preselectedGroupId ? (
              <p className="text-sm text-gray-600">Categoria: {preselectedGroupName}</p>
            ) : (
              <select
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              >
                <option value="">Categoria (opzionale)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-granata text-white py-2 rounded-lg text-sm hover:bg-granata-dark disabled:opacity-60"
            >
              {loading ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
