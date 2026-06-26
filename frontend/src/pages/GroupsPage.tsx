import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups, createGroup, updateGroup, deleteGroup } from '../api/groups'
import { LEVEL_COLORS, GROUP_CATEGORIES } from '../constants/domain'
import { useAuth } from '../context/AuthContext'
import { useSeasonGroup } from '../context/SeasonGroupContext'
import type { Group } from '../types/api'

const LEVELS = Object.keys(LEVEL_COLORS)

type GroupForm = {
  name: string
  category: string
  birth_year: string
  level: string
  sub_group: string
  max_players: string
}

const EMPTY_FORM: GroupForm = {
  name: '',
  category: GROUP_CATEGORIES[0],
  birth_year: '',
  level: LEVELS[0],
  sub_group: '',
  max_players: '18',
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { selectedSeasonId } = useSeasonGroup()

  const load = () => {
    setLoading(true)
    getGroups(selectedSeasonId || undefined)
      .then((res) => setGroups(res.data))
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedSeasonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingGroup(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (e: React.MouseEvent, g: Group) => {
    e.stopPropagation()
    setEditingGroup(g)
    setForm({
      name: g.name,
      category: g.category,
      birth_year: g.birth_year != null ? String(g.birth_year) : '',
      level: g.level,
      sub_group: g.sub_group ?? '',
      max_players: String(g.max_players),
    })
    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingGroup(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      birth_year: form.birth_year ? parseInt(form.birth_year) : null,
      sub_group: form.sub_group || null,
      max_players: parseInt(form.max_players),
    }
    try {
      if (editingGroup) {
        const res = await updateGroup(editingGroup.id, payload)
        setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? res.data : g)))
      } else {
        await createGroup(payload)
        load()
      }
      closeModal()
    } catch {
      setError(editingGroup ? 'Errore nella modifica del gruppo' : 'Errore nella creazione del gruppo')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, groupId: string, groupName: string) => {
    e.stopPropagation()
    if (!window.confirm(`Eliminare il gruppo "${groupName}"?\nLe sessioni e le misurazioni storiche rimarranno nel database.`)) return
    setDeletingId(groupId)
    try {
      await deleteGroup(groupId)
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
    } catch {
      setError('Errore nell\'eliminazione del gruppo')
    } finally {
      setDeletingId(null)
    }
  }

  const sortGroups = (list: Group[]) =>
    [...list].sort((a, b) => {
      const ya = a.birth_year ?? Infinity
      const yb = b.birth_year ?? Infinity
      if (ya !== yb) return ya - yb
      return (a.sub_group ?? '').localeCompare(b.sub_group ?? '', 'it')
    })

  const byCategory = (cat: string) => sortGroups(groups.filter((g) => g.category === cat))
  const uncategorized = sortGroups(groups.filter((g) => !GROUP_CATEGORIES.includes(g.category)))

  const GroupCard = ({ g }: { g: Group }) => (
    <div className="relative">
      <button
        onClick={() => navigate(`/groups/${g.id}`)}
        className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-granata hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-1 pr-16">
          <span className="font-semibold text-gray-900">{g.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[g.level as keyof typeof LEVEL_COLORS] ?? 'bg-gray-100 text-gray-600'}`}>
            {g.level}
          </span>
        </div>
        <div className="text-xs text-gray-500">Max {g.max_players} giocatori</div>
      </button>
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={(e) => openEdit(e, g)}
            className="p-1.5 text-gray-300 hover:text-granata transition-colors"
            title="Modifica gruppo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => handleDelete(e, g.id, g.name)}
            disabled={deletingId === g.id}
            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
            title="Elimina gruppo"
          >
            {deletingId === g.id ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gruppi</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
          >
            + Nuovo gruppo
          </button>
        )}
      </div>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_CATEGORIES.map((cat) => {
            const list = byCategory(cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map((g) => <GroupCard key={g.id} g={g} />)}
                </div>
              </div>
            )
          })}
          {uncategorized.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Altri</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uncategorized.map((g) => <GroupCard key={g.id} g={g} />)}
              </div>
            </div>
          )}
          {!groups.length && (
            <div className="text-center text-gray-400 py-8 text-sm">Nessun gruppo trovato</div>
          )}
        </div>
      )}

      {isAdmin && showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">{editingGroup ? 'Modifica gruppo' : 'Nuovo gruppo'}</h3>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Es. Esordienti A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                  >
                    {GROUP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Livello *</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                  >
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Anno nascita</label>
                  <input
                    type="number"
                    value={form.birth_year}
                    onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
                    placeholder="Es. 2013"
                    min="2000"
                    max="2030"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sottogruppo</label>
                  <input
                    type="text"
                    value={form.sub_group}
                    onChange={(e) => setForm({ ...form, sub_group: e.target.value.slice(0, 1) })}
                    placeholder="A"
                    maxLength={1}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max giocatori</label>
                  <input
                    type="number"
                    value={form.max_players}
                    onChange={(e) => setForm({ ...form, max_players: e.target.value })}
                    min="1"
                    max="50"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-granata text-white py-2 rounded-lg text-sm hover:bg-granata-dark disabled:opacity-60"
                >
                  {saving ? (editingGroup ? 'Salvataggio…' : 'Creazione…') : (editingGroup ? 'Salva modifiche' : 'Crea gruppo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
