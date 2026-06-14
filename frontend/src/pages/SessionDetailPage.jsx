import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, saveMeasurements } from '../api/sessions'
import { getPlayers } from '../api/players'
import { getGroupTargets } from '../api/groups'

// Display label → backend field name
const PARAMS = [
  { label: 'SR',  field: 'scanning_rate' },
  { label: 'DQI', field: 'decision_quality' },
  { label: 'AI',  field: 'anticipation' },
  { label: 'TRS', field: 'transition_reset' },
  { label: 'VCI', field: 'verbal_comm' },
]

// Map backend field → target parameter name (as stored in GroupTarget)
const FIELD_TO_PARAM = {
  scanning_rate:    'SR',
  decision_quality: 'DQI',
  anticipation:     'AI',
  transition_reset: 'TRS',
  verbal_comm:      'VCI',
}

function valueBadgeClass(value, targetsMap, field) {
  const param = FIELD_TO_PARAM[field]
  const t = targetsMap[param]
  if (!t || value === '' || value == null) return 'border-gray-300 bg-white'
  const v = parseFloat(value)
  if (v <= t.insufficient_max) return 'border-red-300 bg-red-50 text-red-800'
  if (v >= t.ottimo_min)       return 'border-green-300 bg-green-50 text-green-800'
  return 'border-yellow-300 bg-yellow-50 text-yellow-800'
}

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''

const emptyMeasurement = () =>
  PARAMS.reduce((acc, { field }) => ({ ...acc, [field]: '' }), { is_absent: false })

export default function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [players, setPlayers] = useState([])
  const [targetsMap, setTargetsMap] = useState({})
  const [measurements, setMeasurements] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const sRes = await getSession(id)
        const s = sRes.data
        setSession(s)

        const [pRes, tRes] = await Promise.all([
          getPlayers(s.group_id),
          getGroupTargets(s.group_id),
        ])

        const sorted = pRes.data.sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)

        // Build targets map: { SR: { insufficient_max, ottimo_min }, ... }
        const tMap = {}
        ;(tRes.data ?? []).forEach((t) => { tMap[t.parameter] = t })
        setTargetsMap(tMap)

        // Initialize measurements from empty, then overlay existing
        const init = {}
        pRes.data.forEach((p) => { init[p.id] = emptyMeasurement() })

        const existing = s.measurements ?? []
        existing.forEach((m) => {
          if (init[m.player_id] !== undefined) {
            init[m.player_id] = {
              scanning_rate:    m.scanning_rate ?? '',
              decision_quality: m.decision_quality ?? '',
              anticipation:     m.anticipation ?? '',
              transition_reset: m.transition_reset ?? '',
              verbal_comm:      m.verbal_comm ?? '',
              is_absent:        m.is_absent ?? false,
            }
          }
        })
        setMeasurements(init)
      } catch {
        setError('Errore nel caricamento della sessione')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleChange = (playerId, field, value) => {
    setMeasurements((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }

  const toggleAbsent = (playerId) => {
    setMeasurements((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], is_absent: !prev[playerId].is_absent },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveOk(false)
    setError('')
    try {
      const payload = players.map((p) => {
        const m = measurements[p.id] ?? emptyMeasurement()
        const absent = m.is_absent
        return {
          player_id: p.id,
          is_absent: absent,
          scanning_rate:    absent ? null : (m.scanning_rate    !== '' ? parseFloat(m.scanning_rate)    : null),
          decision_quality: absent ? null : (m.decision_quality !== '' ? parseFloat(m.decision_quality) : null),
          anticipation:     absent ? null : (m.anticipation     !== '' ? parseFloat(m.anticipation)     : null),
          transition_reset: absent ? null : (m.transition_reset !== '' ? parseFloat(m.transition_reset) : null),
          verbal_comm:      absent ? null : (m.verbal_comm      !== '' ? parseFloat(m.verbal_comm)      : null),
        }
      })
      await saveMeasurements(id, payload)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch {
      setError('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <div className="text-red-600 text-sm">{error || 'Sessione non trovata'}</div>
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate('/sessions')}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{formatDate(session.session_date)}</h1>
          <div className="text-sm text-gray-500 mt-0.5">
            {session.session_type}
            {session.duration_min && ` · ${session.duration_min} min`}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mb-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-200 inline-block" />
          Insuff.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" />
          In crescita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-200 inline-block" />
          Ottimo
        </span>
      </div>

      {/* Players */}
      <div className="space-y-4">
        {players.map((p) => {
          const m = measurements[p.id] ?? emptyMeasurement()
          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-4 transition-opacity ${
                m.is_absent ? 'border-gray-100 opacity-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">
                  {p.last_name} {p.first_name}
                </span>
                <div className="flex items-center gap-2 select-none">
                  <span className="text-sm text-gray-500">Assente</span>
                  <button
                    type="button"
                    onClick={() => toggleAbsent(p.id)}
                    className={`relative inline-flex items-center h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      m.is_absent ? 'bg-red-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                        m.is_absent ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {PARAMS.map(({ label, field }) => (
                  <div key={field} className="text-center">
                    <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.5"
                      value={m[field]}
                      onChange={(e) => handleChange(p.id, field, e.target.value)}
                      disabled={m.is_absent}
                      className={`w-full text-center border rounded-lg text-sm font-semibold min-h-12 focus:outline-none focus:ring-2 focus:ring-granata disabled:cursor-not-allowed transition-colors ${
                        m.is_absent
                          ? 'bg-gray-50 border-gray-200 text-gray-300'
                          : valueBadgeClass(m[field], targetsMap, field)
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {!players.length && (
          <div className="text-center text-gray-400 py-8 text-sm">
            Nessun giocatore nel gruppo
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-gray-200 p-4 flex items-center gap-3 z-20">
        {saveOk && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            ✓ Salvato
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !players.length}
          className="flex-1 bg-granata text-white py-3 rounded-xl font-medium text-sm hover:bg-granata-dark transition-colors disabled:opacity-60"
        >
          {saving ? 'Salvataggio…' : 'Salva sessione'}
        </button>
      </div>
    </div>
  )
}
