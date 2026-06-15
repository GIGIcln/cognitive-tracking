import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, saveMeasurements } from '../api/sessions'
import { getPlayers } from '../api/players'
import { getGroupTargets } from '../api/groups'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateLong } from '../utils/dateUtils'

const PARAMS = COGNITIVE_PARAMS

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

function getMobileBtnClass(n, selectedValue, targetsMap, field) {
  const isSelected = Number(selectedValue) === n
  if (!isSelected) return 'bg-gray-100 text-gray-600 active:bg-gray-200'
  const param = FIELD_TO_PARAM[field]
  const t = targetsMap[param]
  if (!t) return 'bg-granata text-white scale-105'
  if (n <= t.insufficient_max) return 'bg-granata text-white scale-105 ring-2 ring-red-400 ring-offset-1'
  if (n >= t.ottimo_min)       return 'bg-granata text-white scale-105 ring-2 ring-green-400 ring-offset-1'
  return 'bg-granata text-white scale-105 ring-2 ring-yellow-400 ring-offset-1'
}

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
  const [currentIndex, setCurrentIndex] = useState(0)

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

        const tMap = {}
        ;(tRes.data ?? []).forEach((t) => { tMap[t.parameter] = t })
        setTargetsMap(tMap)

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

  const goToNext = () => setCurrentIndex((i) => Math.min(i + 1, players.length - 1))
  const goToPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0))

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

  const currentPlayer = players[currentIndex]
  const currentM = currentPlayer ? (measurements[currentPlayer.id] ?? emptyMeasurement()) : null
  const total = players.length

  return (
    <>
      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden pb-40">
        {/* Sticky header with session info + progress bar */}
        <div className="sticky top-0 -mx-4 px-4 bg-white z-10 pb-3 pt-1 mb-4 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/sessions')}
              className="text-gray-400 text-lg p-1 -ml-1 flex items-center justify-center"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">
                {session.session_type}
                {session.duration_min && ` · ${session.duration_min} min`}
              </h1>
              <div className="text-xs text-gray-500">{formatDateLong(session.session_date)}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">
              Giocatore {currentIndex + 1} di {total}
            </span>
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-granata h-1.5 rounded-full transition-all duration-300"
                style={{ width: total ? `${((currentIndex + 1) / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">
            {error}
          </div>
        )}
        {saveOk && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4 border border-green-200 text-center font-medium">
            ✓ Sessione salvata
          </div>
        )}

        {/* Player card */}
        {currentPlayer && currentM ? (
          <div
            className={`rounded-xl border p-4 transition-colors ${
              currentM.is_absent ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
            }`}
          >
            {/* Name + absent toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-semibold text-gray-900 leading-tight">
                {currentPlayer.last_name} {currentPlayer.first_name}
              </span>
              <div className="flex items-center gap-2 select-none shrink-0 ml-3">
                <span className="text-sm text-gray-500">Assente</span>
                <button
                  type="button"
                  onClick={() => toggleAbsent(currentPlayer.id)}
                  className={`relative inline-flex items-center flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    currentM.is_absent ? 'bg-red-500' : 'bg-gray-200'
                  }`}
                  style={{ width: '52px', height: '28px' }}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                      currentM.is_absent ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {currentM.is_absent ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Giocatore assente — nessun dato da inserire
              </div>
            ) : (
              <div>
                {PARAMS.map(({ italianLabel, field }) => {
                  const selectedValue = currentM[field]
                  return (
                    <div className="mb-5" key={field}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">{italianLabel}</span>
                        <span className="text-sm font-bold text-granata">
                          {selectedValue !== '' && selectedValue != null ? selectedValue : '—'}
                        </span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <button
                            key={n}
                            onClick={() =>
                              handleChange(
                                currentPlayer.id,
                                field,
                                Number(selectedValue) === n ? '' : n
                              )
                            }
                            className={`num-btn h-10 w-full rounded-lg text-sm font-semibold transition-all ${getMobileBtnClass(
                              n,
                              selectedValue,
                              targetsMap,
                              field
                            )}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          !total && (
            <div className="text-center text-gray-400 py-8 text-sm">
              Nessun giocatore nel gruppo
            </div>
          )
        )}

        {/* Sticky bottom navigation — sits above the main bottom nav */}
        <div
          className="fixed left-0 right-0 bg-white border-t border-gray-200 p-3 flex items-center gap-3 z-20"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 disabled:opacity-30 text-sm font-medium"
          >
            ← Precedente
          </button>
          {currentIndex < total - 1 ? (
            <button
              onClick={goToNext}
              className="flex-[2] py-3 px-4 rounded-xl bg-granata text-white text-sm font-semibold"
            >
              Prossimo →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !total}
              className="flex-[2] py-3 px-4 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Salvataggio...' : '✓ Salva sessione'}
            </button>
          )}
        </div>
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block pb-28">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => navigate('/sessions')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{formatDateLong(session.session_date)}</h1>
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

        {/* Players grid */}
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
                        step="1"
                        value={m[field] !== '' && m[field] != null ? Math.round(Number(m[field])) : ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            handleChange(p.id, field, null)
                            return
                          }
                          const num = parseInt(raw, 10)
                          if (!isNaN(num) && num >= 1 && num <= 10) {
                            handleChange(p.id, field, num)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === '.' || e.key === ',') {
                            e.preventDefault()
                          }
                        }}
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
    </>
  )
}
