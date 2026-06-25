import { useState, useEffect, useCallback } from 'react'
import { getAttendance, saveAttendance } from '../api/attendance'

const STATUS_OPTIONS = [
  { value: 'present',   label: 'Presente',    cls: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'absent',    label: 'Assente',     cls: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'justified', label: 'Giustificato', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'injured',   label: 'Infortunato', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
]

function statusLabel(v) {
  return STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v
}
function statusCls(v) {
  return STATUS_OPTIONS.find((o) => o.value === v)?.cls ?? 'bg-gray-100 text-gray-800 border-gray-300'
}

export default function AttendanceTab({ sessionId, players }) {
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    getAttendance(sessionId)
      .then((res) => {
        const map = {}
        for (const r of res.data) map[r.player_id] = r.status
        setAttendance(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  const setStatus = useCallback((playerId, status) => {
    setAttendance((prev) => ({ ...prev, [playerId]: status }))
    setSaveOk(false)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const records = players.map((p) => ({
        player_id: p.id,
        status: attendance[p.id] ?? 'present',
      }))
      await saveAttendance(sessionId, records)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch {
      /* noop */
    } finally {
      setSaving(false)
    }
  }

  const counts = players.reduce((acc, p) => {
    const s = attendance[p.id] ?? 'present'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-7 w-7 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(({ value, label, cls }) =>
          counts[value] ? (
            <span key={value} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
              {counts[value]} {label.toLowerCase()}
            </span>
          ) : null
        )}
      </div>

      {/* Player list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {players.map((p) => {
          const current = attendance[p.id] ?? 'present'
          return (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {p.last_name} {p.first_name}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusCls(current)}`}>
                  {statusLabel(current)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStatus(p.id, value)}
                    className={`text-xs py-1.5 rounded-lg border transition-colors ${
                      current === value
                        ? statusCls(value) + ' font-semibold'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {!players.length && (
        <div className="text-center text-gray-400 text-sm py-8">
          Nessun giocatore nel gruppo
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !players.length}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          saveOk
            ? 'bg-green-600 text-white'
            : 'bg-granata text-white disabled:opacity-50'
        }`}
      >
        {saving ? 'Salvataggio…' : saveOk ? 'Presenze salvate ✓' : 'Salva presenze'}
      </button>
    </div>
  )
}
