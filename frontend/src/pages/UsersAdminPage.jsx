import { useState, useEffect } from 'react'
import { listUsers, updateUser, deleteUser } from '../api/users'
import { getGroups } from '../api/groups'

const STATUS_LABEL = { pending: 'In attesa', active: 'Attivo', suspended: 'Sospeso' }
const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
}
const ROLES = ['admin', 'responsabile_tecnico', 'allenatore']

export default function UsersAdminPage() {
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    Promise.all([listUsers(), getGroups()])
      .then(([uRes, gRes]) => {
        setUsers(uRes.data)
        setGroups(gRes.data)
      })
      .catch(() => setError('Errore nel caricamento utenti'))
      .finally(() => setLoading(false))
  }, [])

  const patch = async (userId, body) => {
    setSaving(userId)
    try {
      const res = await updateUser(userId, body)
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)))
    } catch {
      setError('Errore durante il salvataggio')
    } finally {
      setSaving(null)
    }
  }

  const remove = async (userId) => {
    if (!window.confirm('Eliminare questo utente?')) return
    setSaving(userId)
    try {
      await deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante l\'eliminazione')
    } finally {
      setSaving(null)
    }
  }

  const toggleRole = (user, role) => {
    const roles = user.roles.includes(role)
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role]
    patch(user.id, { roles })
  }

  const setGroup = (user, groupId) => {
    patch(user.id, { assigned_group_ids: groupId ? [groupId] : [] })
  }

  const setStatus = (user, status) => {
    patch(user.id, { status })
  }

  if (loading) return <div className="text-sm text-gray-500">Caricamento utenti…</div>

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Gestione utenti</h2>
      {error && (
        <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 font-medium text-gray-600">Utente</th>
              <th className="pb-2 font-medium text-gray-600">Stato</th>
              <th className="pb-2 font-medium text-gray-600">Ruoli</th>
              <th className="pb-2 font-medium text-gray-600">Gruppo</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="py-2">
                <td className="py-3 pr-4">
                  <div className="font-medium text-gray-900">{u.full_name || '—'}</div>
                  <div className="text-gray-400 text-xs">{u.email}</div>
                </td>
                <td className="py-3 pr-4">
                  <select
                    value={u.status}
                    disabled={saving === u.id}
                    onChange={(e) => setStatus(u, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLOR[u.status] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {Object.entries(STATUS_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        disabled={saving === u.id}
                        onClick={() => toggleRole(u, role)}
                        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                          u.roles.includes(role)
                            ? 'bg-granata text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {role.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <select
                    value={u.assigned_group_ids?.[0] || ''}
                    disabled={saving === u.id}
                    onChange={(e) => setGroup(u, e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-granata"
                  >
                    <option value="">— nessuno —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => remove(u.id)}
                    disabled={saving === u.id}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
