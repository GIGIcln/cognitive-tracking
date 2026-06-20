import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, saveMeasurements, updateSession } from '../api/sessions'
import { getEvents, saveEvents } from '../api/events'
import { getPlayers } from '../api/players'
import { getGroupTargets } from '../api/groups'
import {
  COGNITIVE_PARAMS,
  FIELD_TO_METRIC,
  METRIC_EVENT_CONFIG,
  RELIABILITY_META,
  deriveScore,
  deriveReliability,
} from '../constants/domain'
import { formatDateLong } from '../utils/dateUtils'
import ToggleSwitch from '../components/ToggleSwitch'
import { useAuth } from '../context/AuthContext'

const PARAMS = COGNITIVE_PARAMS

// ── Score-mode helpers ────────────────────────────────────────────────────────

function valueBadgeClass(value, targetsMap, field) {
  const param = FIELD_TO_METRIC[field]
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
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t) return 'bg-granata text-white scale-105'
  if (n <= t.insufficient_max) return 'bg-granata text-white scale-105 ring-2 ring-red-400 ring-offset-1'
  if (n >= t.ottimo_min)       return 'bg-granata text-white scale-105 ring-2 ring-green-400 ring-offset-1'
  return 'bg-granata text-white scale-105 ring-2 ring-yellow-400 ring-offset-1'
}

// ── Event-mode helpers ────────────────────────────────────────────────────────

function scoreBadgeClass(score, targetsMap, field) {
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t || score == null) return 'bg-gray-100 text-gray-500'
  if (score <= t.insufficient_max) return 'bg-red-100 text-red-700'
  if (score >= t.ottimo_min)       return 'bg-green-100 text-green-700'
  return 'bg-yellow-100 text-yellow-700'
}

const emptyMeasurement = () =>
  PARAMS.reduce((acc, { field }) => ({ ...acc, [field]: '' }), { is_absent: false, notes: '' })

const emptyEventRow = () => ({ numerator: 0, denominator: 0, method: 'live' })

function NotesBlock({ notes, editing, value, saving, onChange, onEdit, onSave, onCancel }) {
  const { isAdmin } = useAuth()

  if (editing) {
    return (
      <div className="mt-2">
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Aggiungi note sulla sessione…"
          rows={3}
          className="w-full border border-granata rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
        />
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg"
          >
            Annulla
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-xs text-white bg-granata hover:bg-granata-dark px-3 py-1 rounded-lg disabled:opacity-60"
          >
            {saving ? 'Salvataggio…' : 'Salva note'}
          </button>
        </div>
      </div>
    )
  }

  if (notes) {
    return (
      <div
        className={`mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed ${isAdmin ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
        onClick={isAdmin ? onEdit : undefined}
        title={isAdmin ? 'Clicca per modificare' : undefined}
      >
        {notes}
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <button
      onClick={onEdit}
      className="mt-2 text-xs text-gray-400 hover:text-granata transition-colors flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      Aggiungi note
    </button>
  )
}

export default function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession]       = useState(null)
  const [players, setPlayers]       = useState([])
  const [targetsMap, setTargetsMap] = useState({})
  const [measurements, setMeasurements] = useState({})
  const [eventData, setEventData]   = useState({})   // { [playerId]: { [metricType]: { numerator, denominator, method } } }

  const [entryMode, setEntryMode]   = useState('score')  // 'score' | 'event'
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [saveOk, setSaveOk]         = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const sRes = await getSession(id)
        const s = sRes.data
        setSession(s)
        setNotesValue(s.notes ?? '')

        const [pRes, tRes, eRes] = await Promise.all([
          getPlayers(s.group_id),
          getGroupTargets(s.group_id),
          getEvents(id),
        ])

        const sorted = pRes.data.items.sort((a, b) =>
          a.last_name.localeCompare(b.last_name, 'it') ||
          a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)

        const tMap = {}
        ;(tRes.data ?? []).forEach((t) => { tMap[t.parameter] = t })
        setTargetsMap(tMap)

        // Initialise score-mode state from existing measurements
        const init = {}
        sorted.forEach((p) => { init[p.id] = emptyMeasurement() })
        ;(s.measurements ?? []).forEach((m) => {
          if (init[m.player_id] !== undefined) {
            init[m.player_id] = {
              scanning_rate:    m.scanning_rate ?? '',
              decision_quality: m.decision_quality ?? '',
              anticipation:     m.anticipation ?? '',
              transition_reset: m.transition_reset ?? '',
              verbal_comm:      m.verbal_comm ?? '',
              is_absent:        m.is_absent ?? false,
              notes:            m.notes ?? '',
            }
          }
        })
        setMeasurements(init)

        // Initialise event-mode state from existing events
        const evMap = {}
        ;(eRes.data ?? []).forEach((ev) => {
          if (!evMap[ev.player_id]) evMap[ev.player_id] = {}
          evMap[ev.player_id][ev.metric_type] = {
            numerator:  ev.numerator,
            denominator: ev.denominator,
            method:      ev.method,
          }
        })
        // Auto-switch to event mode if this session already has events
        if (Object.keys(evMap).length > 0) setEntryMode('event')
        setEventData(evMap)
      } catch {
        setError('Errore nel caricamento della sessione')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // ── Score-mode handlers ─────────────────────────────────────────────────────

  const handleChange = useCallback((playerId, field, value) => {
    setMeasurements((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }, [])

  const toggleAbsent = useCallback((playerId) => {
    setMeasurements((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], is_absent: !prev[playerId].is_absent },
    }))
  }, [])

  const handleSaveScores = async () => {
    setSaving(true); setSaveOk(false); setError('')
    try {
      const payload = players.map((p) => {
        const m = measurements[p.id] ?? emptyMeasurement()
        const absent = m.is_absent
        return {
          player_id:        p.id,
          is_absent:        absent,
          scanning_rate:    absent ? null : (m.scanning_rate    !== '' ? parseFloat(m.scanning_rate)    : null),
          decision_quality: absent ? null : (m.decision_quality !== '' ? parseFloat(m.decision_quality) : null),
          anticipation:     absent ? null : (m.anticipation     !== '' ? parseFloat(m.anticipation)     : null),
          transition_reset: absent ? null : (m.transition_reset !== '' ? parseFloat(m.transition_reset) : null),
          verbal_comm:      absent ? null : (m.verbal_comm      !== '' ? parseFloat(m.verbal_comm)      : null),
          notes:            absent ? null : (m.notes || null),
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

  // ── Event-mode handlers ─────────────────────────────────────────────────────

  const handleEventChange = useCallback((playerId, metricType, key, delta) => {
    setEventData((prev) => {
      const playerData = prev[playerId] ?? {}
      const current = playerData[metricType] ?? emptyEventRow()
      const updated = { ...current, [key]: Math.max(0, current[key] + delta) }
      return { ...prev, [playerId]: { ...playerData, [metricType]: updated } }
    })
  }, [])

  const handleEventSet = useCallback((playerId, metricType, key, value) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) return
    setEventData((prev) => {
      const playerData = prev[playerId] ?? {}
      const current = playerData[metricType] ?? emptyEventRow()
      return { ...prev, [playerId]: { ...playerData, [metricType]: { ...current, [key]: num } } }
    })
  }, [])

  const handleSaveEvents = async () => {
    setSaving(true); setSaveOk(false); setError('')
    try {
      const events = []
      players.forEach((p) => {
        const absent = measurements[p.id]?.is_absent
        if (absent) return
        const playerEvs = eventData[p.id] ?? {}
        PARAMS.forEach(({ field }) => {
          const metricType = FIELD_TO_METRIC[field]
          const ev = playerEvs[metricType]
          if (!ev) return
          const cfg = METRIC_EVENT_CONFIG[field]
          // Only send if there's at least some data entered
          if (ev.numerator === 0 && ev.denominator === 0 && !cfg.count_only) return
          if (cfg.count_only && ev.numerator === 0) return
          events.push({
            player_id:      p.id,
            metric_type:    metricType,
            numerator:      ev.numerator,
            denominator:    cfg.count_only ? 1 : ev.denominator,
            method:         ev.method,
            observer_notes: null,
          })
        })
      })
      if (events.length === 0) {
        setError('Nessun evento da salvare')
        setSaving(false)
        return
      }
      await saveEvents(id, events)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch {
      setError('Errore nel salvataggio degli eventi')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      const res = await updateSession(id, { notes: notesValue || null })
      setSession((prev) => ({ ...prev, notes: res.data.notes }))
      setEditingNotes(false)
    } catch {
      setError('Errore nel salvataggio delle note')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleSave = entryMode === 'event' ? handleSaveEvents : handleSaveScores

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

  // ── EVENT-MODE sub-components ─────────────────────────────────────────────

  const EventParamRow = ({ field, playerId, compact = false }) => {
    const metricType = FIELD_TO_METRIC[field]
    const cfg = METRIC_EVENT_CONFIG[field]
    const ev = eventData[playerId]?.[metricType] ?? emptyEventRow()
    const score = deriveScore(metricType, ev.numerator, ev.denominator)
    const rel = deriveReliability(metricType, ev.numerator, ev.denominator)
    const relMeta = RELIABILITY_META[rel]
    const badgeClass = scoreBadgeClass(score, targetsMap, field)
    const param = COGNITIVE_PARAMS.find((p) => p.field === field)

    const CounterBtn = ({ counterKey, delta }) => (
      <button
        onClick={() => handleEventChange(playerId, metricType, counterKey, delta)}
        className={`w-7 h-7 rounded-md font-bold text-sm flex items-center justify-center shrink-0 ${
          delta > 0
            ? 'bg-granata text-white active:opacity-80'
            : 'bg-gray-100 text-gray-600 active:bg-gray-200'
        }`}
      >{delta > 0 ? '+' : '−'}</button>
    )

    const CounterInput = ({ counterKey }) => (
      <input
        type="number"
        min="0"
        value={ev[counterKey]}
        onChange={(e) => handleEventSet(playerId, metricType, counterKey, e.target.value)}
        className="w-11 text-center text-sm font-semibold border border-gray-300 rounded-md py-1 focus:outline-none focus:ring-2 focus:ring-granata"
      />
    )

    if (compact) {
      // Desktop: card layout with num/denom side-by-side on one row
      return (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          {/* Header: metric name + score/reliability (both shrink safely) */}
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <span className="text-xs font-semibold text-gray-800 shrink-0">
              {param.label}
            </span>
            <span className="text-xs text-gray-400 truncate">{param.italianLabel}</span>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {score != null && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                  {score.toFixed(1)}
                </span>
              )}
              <span className={`text-xs font-medium whitespace-nowrap ${relMeta.color}`}>
                {relMeta.label}
              </span>
            </div>
          </div>

          {/* Counters inline: [Num label] [−][n][+]  /  [Den label] [−][d][+] */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 shrink-0 w-4">N</span>
              <CounterBtn counterKey="numerator" delta={-1} />
              <CounterInput counterKey="numerator" />
              <CounterBtn counterKey="numerator" delta={1} />
            </div>
            {!cfg.count_only && (
              <>
                <span className="text-gray-300 font-light select-none">/</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 shrink-0 w-4">D</span>
                  <CounterBtn counterKey="denominator" delta={-1} />
                  <CounterInput counterKey="denominator" />
                  <CounterBtn counterKey="denominator" delta={1} />
                </div>
              </>
            )}
          </div>

          {/* Labels below counters */}
          <div className="mt-1.5 text-[10px] text-gray-400 leading-tight">
            N: {cfg.numerator_label}
            {!cfg.count_only && <span>  ·  D: {cfg.denominator_label}</span>}
          </div>
        </div>
      )
    }

    // Mobile: stacked layout (unchanged)
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">
            {param.label} <span className="text-gray-400 font-normal">· {param.italianLabel}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {score != null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                {score.toFixed(1)}
              </span>
            )}
            <span className={`text-xs ${relMeta.color}`}>{relMeta.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500 w-36 shrink-0">{cfg.numerator_label}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleEventChange(playerId, metricType, 'numerator', -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-base flex items-center justify-center active:bg-gray-200">−</button>
            <input type="number" min="0" value={ev.numerator} onChange={(e) => handleEventSet(playerId, metricType, 'numerator', e.target.value)} className="w-14 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-granata" />
            <button onClick={() => handleEventChange(playerId, metricType, 'numerator', 1)} className="w-8 h-8 rounded-lg bg-granata text-white font-bold text-base flex items-center justify-center active:opacity-80">+</button>
          </div>
        </div>

        {!cfg.count_only && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-36 shrink-0">{cfg.denominator_label}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleEventChange(playerId, metricType, 'denominator', -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-base flex items-center justify-center active:bg-gray-200">−</button>
              <input type="number" min="0" value={ev.denominator} onChange={(e) => handleEventSet(playerId, metricType, 'denominator', e.target.value)} className="w-14 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-granata" />
              <button onClick={() => handleEventChange(playerId, metricType, 'denominator', 1)} className="w-8 h-8 rounded-lg bg-granata text-white font-bold text-base flex items-center justify-center active:opacity-80">+</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden pb-40">
        {/* Sticky header */}
        <div className="sticky top-0 -mx-4 px-4 bg-white z-10 pb-3 pt-1 mb-4 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
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

          {/* Mode toggle */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Modalità inserimento</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setEntryMode('score')}
                className={`px-3 py-1.5 ${entryMode === 'score' ? 'bg-granata text-white' : 'bg-white text-gray-600'}`}
              >Voto 1–10</button>
              <button
                onClick={() => setEntryMode('event')}
                className={`px-3 py-1.5 ${entryMode === 'event' ? 'bg-granata text-white' : 'bg-white text-gray-600'}`}
              >Conteggio eventi</button>
            </div>
          </div>

          {/* Note sessione — mobile */}
          <NotesBlock
            notes={session.notes}
            editing={editingNotes}
            value={notesValue}
            saving={savingNotes}
            onChange={setNotesValue}
            onEdit={() => setEditingNotes(true)}
            onSave={handleSaveNotes}
            onCancel={() => { setEditingNotes(false); setNotesValue(session.notes ?? '') }}
          />

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
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>
        )}
        {saveOk && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4 border border-green-200 text-center font-medium">
            ✓ Sessione salvata
          </div>
        )}

        {/* Player card */}
        {currentPlayer && currentM ? (
          <div className={`rounded-xl border p-4 transition-colors ${currentM.is_absent ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-semibold text-gray-900 leading-tight">
                {currentPlayer.last_name} {currentPlayer.first_name}
              </span>
              <div className="flex items-center gap-2 select-none shrink-0 ml-3">
                <span className="text-sm text-gray-500">Assente</span>
                <ToggleSwitch
                  checked={currentM.is_absent}
                  onChange={() => toggleAbsent(currentPlayer.id)}
                  size="md"
                />
              </div>
            </div>

            {currentM.is_absent ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Giocatore assente — nessun dato da inserire
              </div>
            ) : entryMode === 'score' ? (
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
                        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                          <button
                            key={n}
                            onClick={() =>
                              handleChange(currentPlayer.id, field, Number(selectedValue) === n ? '' : n)
                            }
                            className={`num-btn h-10 w-full rounded-lg text-sm font-semibold transition-all ${getMobileBtnClass(n, selectedValue, targetsMap, field)}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Event mode */
              <div>
                <p className="text-xs text-gray-400 mb-4">
                  Inserisci i conteggi osservati. Il punteggio 1–10 viene calcolato automaticamente.
                </p>
                {PARAMS.map(({ field }) => (
                  <EventParamRow key={field} field={field} playerId={currentPlayer.id} />
                ))}
              </div>
            )}

            {!currentM.is_absent && (
              <div className="mt-4">
                <label className="text-xs text-gray-500 mb-1 block">Note giocatore</label>
                <textarea
                  value={currentM.notes ?? ''}
                  onChange={(e) => handleChange(currentPlayer.id, 'notes', e.target.value)}
                  placeholder="Osservazioni facoltative…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                />
              </div>
            )}
          </div>
        ) : (
          !total && (
            <div className="text-center text-gray-400 py-8 text-sm">Nessun giocatore nel gruppo</div>
          )
        )}

        {/* Sticky bottom nav */}
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
        <div className="flex items-start gap-3 mb-4">
          <button
            onClick={() => navigate('/sessions')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{formatDateLong(session.session_date)}</h1>
            <div className="text-sm text-gray-500 mt-0.5">
              {session.session_type}
              {session.duration_min && ` · ${session.duration_min} min`}
            </div>
          </div>

          {/* Mode toggle — desktop */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium shrink-0">
            <button
              onClick={() => setEntryMode('score')}
              className={`px-4 py-2 ${entryMode === 'score' ? 'bg-granata text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Voto 1–10</button>
            <button
              onClick={() => setEntryMode('event')}
              className={`px-4 py-2 ${entryMode === 'event' ? 'bg-granata text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Conteggio eventi</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>
        )}

        {/* Note sessione — desktop */}
        <div className="mb-5">
          <NotesBlock
            notes={session.notes}
            editing={editingNotes}
            value={notesValue}
            saving={savingNotes}
            onChange={setNotesValue}
            onEdit={() => setEditingNotes(true)}
            onSave={handleSaveNotes}
            onCancel={() => { setEditingNotes(false); setNotesValue(session.notes ?? '') }}
          />
        </div>

        {entryMode === 'event' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-xs text-blue-700">
            <strong>Modalità conteggio eventi</strong> — inserisci i conteggi osservati (numeratore / denominatore) per ogni metrica.
            Il punteggio 1–10 viene derivato automaticamente e scritto nelle misurazioni. Il badge indica l'affidabilità statistica del dato.
          </div>
        )}

        {entryMode === 'score' && (
          /* Score-mode legend */
          <div className="flex gap-3 mb-5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Insuff.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" /> In crescita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Ottimo
            </span>
          </div>
        )}

        {/* Players */}
        <div className="space-y-4">
          {players.map((p) => {
            const m = measurements[p.id] ?? emptyMeasurement()
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border p-4 transition-opacity ${m.is_absent ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}
              >
                {/* Player header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{p.last_name} {p.first_name}</span>
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm text-gray-500">Assente</span>
                    <ToggleSwitch checked={m.is_absent} onChange={() => toggleAbsent(p.id)} size="sm" />
                  </div>
                </div>

                {!m.is_absent && entryMode === 'score' && (
                  <div className="grid grid-cols-5 gap-2">
                    {PARAMS.map(({ label, field }) => (
                      <div key={field} className="text-center">
                        <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
                        <input
                          type="number"
                          min="1" max="10" step="1"
                          value={m[field] !== '' && m[field] != null ? Math.round(Number(m[field])) : ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw === '') { handleChange(p.id, field, null); return }
                            const num = parseInt(raw, 10)
                            if (!isNaN(num) && num >= 1 && num <= 10) handleChange(p.id, field, num)
                          }}
                          onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
                          disabled={m.is_absent}
                          className={`w-full text-center border rounded-lg text-sm font-semibold min-h-12 focus:outline-none focus:ring-2 focus:ring-granata disabled:cursor-not-allowed transition-colors ${
                            m.is_absent ? 'bg-gray-50 border-gray-200 text-gray-300' : valueBadgeClass(m[field], targetsMap, field)
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {!m.is_absent && entryMode === 'event' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {PARAMS.map(({ field }) => (
                      <EventParamRow key={field} field={field} playerId={p.id} compact />
                    ))}
                  </div>
                )}

                {!m.is_absent && (
                  <div className="mt-3">
                    <textarea
                      value={m.notes ?? ''}
                      onChange={(e) => handleChange(p.id, 'notes', e.target.value)}
                      placeholder="Note giocatore…"
                      rows={1}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {!players.length && (
            <div className="text-center text-gray-400 py-8 text-sm">Nessun giocatore nel gruppo</div>
          )}
        </div>

        {/* Sticky save bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-gray-200 p-4 flex items-center gap-3 z-20">
          {saveOk && (
            <span className="text-green-600 text-sm font-medium flex items-center gap-1">✓ Salvato</span>
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
