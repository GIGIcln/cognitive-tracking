import { useState, useEffect, useCallback } from 'react'
import { useBlocker } from 'react-router-dom'
import { getSession, saveMeasurements, updateSession } from '../api/sessions'
import { getEvents, saveEvents } from '../api/events'
import { getPlayers } from '../api/players'
import { getGroupTargets } from '../api/groups'
import {
  COGNITIVE_PARAMS,
  FIELD_TO_METRIC,
  METRIC_EVENT_CONFIG,
  deriveReliability,
} from '../constants/domain'
import { emptyEventRow } from '../components/EventParamRow'

const PARAMS = COGNITIVE_PARAMS

const emptyMeasurement = () =>
  PARAMS.reduce((acc, { field }) => ({ ...acc, [field]: '' }), { is_absent: false, notes: '' })

export function useSessionForm(id) {
  const [session, setSession]           = useState(null)
  const [players, setPlayers]           = useState([])
  const [targetsMap, setTargetsMap]     = useState({})
  const [measurements, setMeasurements] = useState({})
  const [eventData, setEventData]       = useState({})

  const [entryMode, setEntryMode]           = useState('event')
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [saveOk, setSaveOk]                 = useState(false)
  const [currentIndex, setCurrentIndex]     = useState(0)
  const [editingNotes, setEditingNotes]     = useState(false)
  const [notesValue, setNotesValue]         = useState('')
  const [savingNotes, setSavingNotes]       = useState(false)
  const [isDirty, setIsDirty]               = useState(false)
  const [mixedVersionWarning, setMixedVersionWarning] = useState(false)

  const blocker = useBlocker(isDirty)

  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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

        const evMap = {}
        const seenVersions = new Set()
        ;(eRes.data ?? []).forEach((ev) => {
          if (!evMap[ev.player_id]) evMap[ev.player_id] = {}
          evMap[ev.player_id][ev.metric_type] = {
            numerator:   ev.numerator,
            denominator: ev.denominator,
            method:      ev.method,
          }
          if (ev.codebook_version) seenVersions.add(ev.codebook_version)
        })
        if (seenVersions.size > 1) setMixedVersionWarning(true)
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

  const handleChange = useCallback((playerId, field, value) => {
    setIsDirty(true)
    setMeasurements((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }, [])

  const toggleAbsent = useCallback((playerId) => {
    setIsDirty(true)
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
      setIsDirty(false)
      setTimeout(() => setSaveOk(false), 2500)
    } catch {
      setError('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleEventChange = useCallback((playerId, metricType, key, delta) => {
    setIsDirty(true)
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
    setIsDirty(true)
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
      const savedResp = await saveEvents(id, events)
      if ((savedResp.data ?? []).some((ev) => ev.codebook_version === null)) {
        setMixedVersionWarning(true)
      }
      setSaveOk(true)
      setIsDirty(false)
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

  const getReliabilityOkCount = useCallback((playerId) => {
    let ok = 0
    PARAMS.forEach(({ field }) => {
      const metricType = FIELD_TO_METRIC[field]
      const ev = eventData[playerId]?.[metricType]
      if (!ev) return
      const cfg = METRIC_EVENT_CONFIG[field]
      if (cfg.count_only && ev.numerator === 0) return
      if (!cfg.count_only && ev.numerator === 0 && ev.denominator === 0) return
      const rel = deriveReliability(metricType, ev.numerator, ev.denominator)
      if (rel === 'medium' || rel === 'high') ok++
    })
    return ok
  }, [eventData])

  const hasAnyEventData = useCallback((playerId) =>
    PARAMS.some(({ field }) => {
      const metricType = FIELD_TO_METRIC[field]
      const ev = eventData[playerId]?.[metricType]
      if (!ev) return false
      const cfg = METRIC_EVENT_CONFIG[field]
      return cfg.count_only ? ev.numerator > 0 : ev.numerator > 0 || ev.denominator > 0
    }), [eventData])

  const hasInsufficientMetric = useCallback((playerId) =>
    PARAMS.some(({ field }) => {
      const metricType = FIELD_TO_METRIC[field]
      const ev = eventData[playerId]?.[metricType]
      if (!ev) return false
      const cfg = METRIC_EVENT_CONFIG[field]
      if (cfg.count_only && ev.numerator === 0) return false
      if (!cfg.count_only && ev.numerator === 0 && ev.denominator === 0) return false
      return deriveReliability(metricType, ev.numerator, ev.denominator) === 'insufficient'
    }), [eventData])

  const currentPlayer = players[currentIndex]
  const currentM = currentPlayer ? (measurements[currentPlayer.id] ?? emptyMeasurement()) : null
  const total = players.length

  const insufficientCount = entryMode === 'event'
    ? players.filter((p) => {
        const m = measurements[p.id] ?? emptyMeasurement()
        return !m.is_absent && hasAnyEventData(p.id) && getReliabilityOkCount(p.id) < PARAMS.length
      }).length
    : 0

  const insufficientGateCount = entryMode === 'event'
    ? players.filter((p) => {
        const m = measurements[p.id] ?? emptyMeasurement()
        return !m.is_absent && hasAnyEventData(p.id) && hasInsufficientMetric(p.id)
      }).length
    : 0

  return {
    session,
    players,
    targetsMap,
    measurements,
    eventData,
    entryMode,
    setEntryMode,
    loading,
    saving,
    error,
    saveOk,
    currentIndex,
    editingNotes,
    setEditingNotes,
    notesValue,
    setNotesValue,
    savingNotes,
    isDirty,
    mixedVersionWarning,
    blocker,
    currentPlayer,
    currentM,
    total,
    handleChange,
    toggleAbsent,
    handleSave,
    handleEventChange,
    handleEventSet,
    handleSaveNotes,
    goToNext,
    goToPrev,
    getReliabilityOkCount,
    hasAnyEventData,
    hasInsufficientMetric,
    insufficientCount,
    insufficientGateCount,
  }
}
