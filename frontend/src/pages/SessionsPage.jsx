import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, createSession, deleteSession } from '../api/sessions'
import { getGroups } from '../api/groups'
import { getCurrentSeason } from '../api/seasons'
import { SESSION_TYPES } from '../constants/domain'
import { formatDateLong } from '../utils/dateUtils'
import { useAuth } from '../context/AuthContext'

const SESSION_TYPE_COLOR = {
  'SSG':            'bg-blue-500',
  'Partita a tema': 'bg-amber-500',
  'Partita':        'bg-red-500',
}
const SESSION_TYPE_ABBR = {
  'SSG':            'SSG',
  'Partita a tema': 'P.T.',
  'Partita':        'Par',
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function buildCalendarGrid(year, month, sessions) {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const byDate = {}
  sessions.forEach((s) => {
    byDate[s.session_date] ??= []
    byDate[s.session_date].push(s)
  })
  const cells = Array.from({ length: startOffset }, () => ({ day: null, iso: null, sessions: [] }))
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso, sessions: byDate[iso] ?? [] })
  }
  return cells
}

function CalendarView({ sessions, calMonth, setCalMonth, navigate }) {
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const cells = buildCalendarGrid(year, month, sessions)
  const today = new Date().toISOString().split('T')[0]
  const monthLabel = calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          ←
        </button>
        <span className="font-semibold text-gray-900 capitalize">{monthLabel}</span>
        <button
          onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          →
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`bg-white min-h-[72px] p-1.5 ${!cell.day ? 'opacity-0 pointer-events-none' : ''}`}
          >
            {cell.day && (
              <>
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  cell.iso === today
                    ? 'bg-granata text-white'
                    : 'text-gray-500'
                }`}>
                  {cell.day}
                </div>
                <div className="space-y-0.5">
                  {cell.sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/sessions/${s.id}`)}
                      className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-semibold text-white truncate transition-opacity hover:opacity-80 ${
                        SESSION_TYPE_COLOR[s.session_type] ?? 'bg-gray-400'
                      }`}
                      title={`${s.session_type}${s.duration_min ? ` · ${s.duration_min} min` : ''}`}
                    >
                      {SESSION_TYPE_ABBR[s.session_type] ?? s.session_type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        {Object.entries(SESSION_TYPE_ABBR).map(([type, abbr]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-sm inline-block ${SESSION_TYPE_COLOR[type]}`} />
            {type}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState({
    group_id: '',
    session_date: new Date().toISOString().split('T')[0],
    session_type: 'SSG',
    duration_min: '',
    notes: '',
  })
  const [seasonRange, setSeasonRange] = useState({ min: '', max: '' })
  const [viewMode, setViewMode] = useState('list')
  const [calMonth, setCalMonth] = useState(() => new Date())
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!showModal) return
    getCurrentSeason()
      .then((res) => {
        const { start_date, end_date } = res.data
        const min = start_date ?? ''
        const max = end_date ?? ''
        setSeasonRange({ min, max })
        const today = new Date().toISOString().split('T')[0]
        let defaultDate = today
        if (min && today < min) defaultDate = min
        if (max && today > max) defaultDate = max
        setForm((f) => ({ ...f, session_date: defaultDate }))
      })
      .catch(() => {})
  }, [showModal])

  const loadSessions = (groupId) => {
    setLoading(true)
    getSessions(groupId || undefined)
      .then((res) => setSessions(res.data.items ?? []))
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getGroups().then((res) => {
      setGroups(res.data)
      if (res.data.length) {
        setForm((f) => ({ ...f, group_id: res.data[0].id }))
      }
    })
    loadSessions()
  }, [])

  const handleGroupFilter = (e) => {
    setSelectedGroup(e.target.value)
    loadSessions(e.target.value)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        duration_min: form.duration_min ? parseInt(form.duration_min) : null,
        notes: form.notes || null,
      }
      const res = await createSession(payload)
      setShowModal(false)
      navigate(`/sessions/${res.data.id}`)
    } catch {
      setError('Errore nella creazione della sessione')
      setSaving(false)
    }
  }

  const handleDelete = async (e, sessionId, sessionLabel) => {
    e.stopPropagation()
    if (!window.confirm(`Eliminare la sessione "${sessionLabel}"?`)) return
    setDeletingId(sessionId)
    try {
      await deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch {
      setError('Errore nell\'eliminazione della sessione')
    } finally {
      setDeletingId(null)
    }
  }

  const groupName = (gId) => groups.find((g) => g.id === gId)?.name ?? '–'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sessioni</h1>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-granata text-white text-sm px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
          >
            + Nuova sessione
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <select
          value={selectedGroup}
          onChange={handleGroupFilter}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
        >
          <option value="">Tutti i gruppi</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium ml-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-granata text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-2 ${viewMode === 'calendar' ? 'bg-granata text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Calendario
          </button>
        </div>
      </div>

      {error && !showModal && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          sessions={sessions}
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          navigate={navigate}
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const label = `${formatDateLong(s.session_date)} · ${s.session_type}`
            return (
              <div key={s.id} className="relative">
                <button
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-granata hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between pr-8">
                    <div>
                      <div className="font-medium text-gray-900">{formatDateLong(s.session_date)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.session_type} · {groupName(s.group_id)}
                        {s.duration_min && ` · ${s.duration_min} min`}
                      </div>
                      {s.notes && (
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{s.notes}</div>
                      )}
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => handleDelete(e, s.id, label)}
                    disabled={deletingId === s.id}
                    className="absolute top-1/2 -translate-y-1/2 right-3 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Elimina sessione"
                  >
                    {deletingId === s.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )
          })}
          {!sessions.length && (
            <div className="text-center text-gray-400 py-8 text-sm">
              Nessuna sessione trovata
            </div>
          )}
        </div>
      )}

      {isAdmin && showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Nuova sessione</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gruppo</label>
                <select
                  value={form.group_id}
                  onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                >
                  <option value="">Seleziona gruppo…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input
                  type="date"
                  value={form.session_date}
                  onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                  min={seasonRange.min || undefined}
                  max={seasonRange.max || undefined}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  value={form.session_type}
                  onChange={(e) => setForm({ ...form, session_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                >
                  {SESSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Durata (minuti)</label>
                <input
                  type="number"
                  placeholder="Es. 60"
                  min="1"
                  value={form.duration_min}
                  onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <textarea
                  placeholder="Opzionale"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                  rows={2}
                />
              </div>
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
                  {saving ? 'Creazione…' : 'Crea sessione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
