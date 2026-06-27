import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getPlayer, getPlayerHistory, getPlayerAssignments, getPlayerStreak, getPlayerSummary } from '../api/players'
import { listInjuries, createInjury, updateInjury, deleteInjury } from '../api/injuries'
import { getPlayerMatches } from '../api/matches'
import { getPlayerAttendance } from '../api/attendance'
import { COGNITIVE_PARAMS, METRIC_COLORS } from '../constants/domain'
import AvailabilityBadge from '../components/AvailabilityBadge'
import type { Player, PlayerAssignment, PlayerHistoryItem, InjuryLog, PlayerMatchItem, PlayerAttendanceItem, PlayerSummary } from '../types/api'

const METRICS = COGNITIVE_PARAMS.map((p) => ({ key: p.field, label: p.label, color: METRIC_COLORS[p.field] }))

function fmt(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function fmtFull(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function GroupsTimeline({ assignments, loading }: { assignments: PlayerAssignment[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }
  if (!assignments.length) {
    return <div className="text-center text-gray-400 py-12 text-sm">Nessuna assegnazione registrata</div>
  }
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {assignments.map((a) => (
          <div key={a.id} className="relative">
            <div className={`absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${a.is_current ? 'bg-granata' : 'bg-gray-400'}`} />
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">{a.group_name}</span>
                {a.is_current && (
                  <span className="text-xs bg-granata/10 text-granata font-medium px-2 py-0.5 rounded-full">Attuale</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {fmtFull(a.start_date)}
                {a.end_date ? ` → ${fmtFull(a.end_date)}` : ' → oggi'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsTrend({ history, loading }: { history: PlayerHistoryItem[]; loading: boolean }) {
  const [visible, setVisible] = useState<Set<string>>(new Set(METRICS.map((m) => m.key)))

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }
  if (!history.length) {
    return <div className="text-center text-gray-400 py-12 text-sm">Nessuna sessione registrata</div>
  }

  const chartData = history.map((h) => ({
    date: fmt(h.session_date),
    group: h.group_name,
    scanning_rate: h.scanning_rate,
    decision_quality: h.decision_quality,
    anticipation: h.anticipation,
    transition_reset: h.transition_reset,
    verbal_comm: h.verbal_comm,
  }))

  const toggle = (key: string) =>
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
      return next
    })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            className={`text-xs px-3 py-1 rounded-full font-medium border transition-colors ${
              visible.has(m.key)
                ? 'text-white border-transparent'
                : 'text-gray-400 border-gray-200 bg-white'
            }`}
            style={visible.has(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(v, name) => {
                const m = METRICS.find((x) => x.key === name)
                return [typeof v === 'number' ? v.toFixed(1) : '—', m?.label ?? name]
              }}
              labelFormatter={(label, payload) => {
                const group = payload?.[0]?.payload?.group
                return `${label}${group ? ` · ${group}` : ''}`
              }}
            />
            <Legend
              formatter={(value) => METRICS.find((m) => m.key === value)?.label ?? value}
              wrapperStyle={{ fontSize: 11 }}
            />
            {METRICS.filter((m) => visible.has(m.key)).map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3, fill: m.color }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-400 mt-2 text-right">{history.length} sessioni totali</div>
    </div>
  )
}

const SEVERITY_LABELS: Record<string, string> = { lieve: 'Lieve', moderato: 'Moderato', grave: 'Grave' }
const SEVERITY_COLORS: Record<string, string> = {
  lieve:    'bg-amber-100 text-amber-700',
  moderato: 'bg-orange-100 text-orange-700',
  grave:    'bg-red-100 text-red-700',
}
const INJURY_TYPES = [
  'Distorsione', 'Stiramento muscolare', 'Lesione muscolare', 'Contusione',
  'Frattura', 'Lesione legamentosa', 'Tendinite', 'Altro',
]

function InjuryTab({ playerId }: { playerId: string }) {
  const [injuries, setInjuries] = useState<InjuryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    injury_type: '', start_date: '', severity: 'moderato',
    expected_return: '', notes: '',
  })

  const reload = () => {
    listInjuries(playerId)
      .then((res) => setInjuries(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createInjury(playerId, {
        injury_type: form.injury_type,
        start_date: form.start_date,
        severity: form.severity,
        expected_return: form.expected_return || null,
        notes: form.notes || null,
      })
      setForm({ injury_type: '', start_date: '', severity: 'moderato', expected_return: '', notes: '' })
      setShowForm(false)
      reload()
    } catch {
      // errore silenzioso, form rimane aperto
    } finally {
      setSaving(false)
    }
  }

  const handleReturn = async (injuryId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await updateInjury(injuryId, { actual_return: today })
    reload()
  }

  const handleDelete = async (injuryId: string) => {
    if (!window.confirm('Eliminare questo infortunio?')) return
    await deleteInjury(injuryId)
    reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm bg-granata text-white px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors"
        >
          {showForm ? 'Annulla' : '+ Aggiungi infortunio'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo infortunio</label>
              <select
                required
                value={form.injury_type}
                onChange={(e) => setForm((f) => ({ ...f, injury_type: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              >
                <option value="">— seleziona —</option>
                {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gravità</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              >
                <option value="lieve">Lieve</option>
                <option value="moderato">Moderato</option>
                <option value="grave">Grave</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data inizio</label>
              <input
                required type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rientro previsto</label>
              <input
                type="date"
                value={form.expected_return}
                onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Note</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
              placeholder="Note aggiuntive…"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-granata text-white px-4 py-2 rounded-lg hover:bg-granata-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      )}

      {injuries.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">Nessun infortunio registrato</div>
      ) : (
        <div className="space-y-3">
          {injuries.map((inj) => {
            const isActive = !inj.actual_return
            return (
              <div key={inj.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{inj.injury_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                        {SEVERITY_LABELS[inj.severity] ?? inj.severity}
                      </span>
                      {isActive && (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                          Attivo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>Inizio: {new Date(inj.start_date).toLocaleDateString('it-IT')}</div>
                      {inj.expected_return && (
                        <div>Rientro previsto: {new Date(inj.expected_return).toLocaleDateString('it-IT')}</div>
                      )}
                      {inj.actual_return && (
                        <div>Rientro effettivo: {new Date(inj.actual_return).toLocaleDateString('it-IT')}</div>
                      )}
                      {inj.notes && <div className="text-gray-400 italic mt-1">{inj.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive && (
                      <button
                        onClick={() => handleReturn(inj.id)}
                        className="text-xs text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        Segna rientro
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(inj.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SESSION_TYPE_LABELS: Record<string, string> = { training: 'Allenamento', match: 'Partita', test: 'Test' }
const ATTENDANCE_STATUS: Record<string, { label: string; cls: string }> = {
  present:   { label: 'Presente',    cls: 'bg-green-100 text-green-700' },
  absent:    { label: 'Assente',     cls: 'bg-red-100 text-red-700' },
  justified: { label: 'Giustificato', cls: 'bg-yellow-100 text-yellow-700' },
  injured:   { label: 'Infortunato', cls: 'bg-orange-100 text-orange-700' },
}

function AttendanceTab({ playerId }: { playerId: string }) {
  const [records, setRecords] = useState<PlayerAttendanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlayerAttendance(playerId)
      .then((res) => setRecords(res.data as PlayerAttendanceItem[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!records.length) {
    return <div className="text-center text-gray-400 py-12 text-sm">Nessuna presenza registrata</div>
  }

  const total = records.length
  const present = records.filter((r) => r.status === 'present').length
  const absent = records.filter((r) => r.status === 'absent').length
  const justified = records.filter((r) => r.status === 'justified').length
  const injured = records.filter((r) => r.status === 'injured').length
  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '% presenze', value: `${pct}%` },
          { label: 'Presenti', value: present },
          { label: 'Assenti', value: absent },
          { label: 'Giustificati', value: justified + injured },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-2 text-center">
            <div className="text-lg font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {records.map((r) => {
          const st = ATTENDANCE_STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' }
          return (
            <div key={r.session_id} className="flex items-center justify-between px-4 py-2.5 gap-2">
              <div className="min-w-0">
                <div className="text-sm text-gray-900">
                  {new Date(r.session_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  <span className="text-xs text-gray-400 ml-2">{SESSION_TYPE_LABELS[r.session_type] ?? r.session_type}</span>
                </div>
                {r.note && <div className="text-xs text-gray-400 mt-0.5 italic">{r.note}</div>}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${st.cls}`}>
                {st.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="text-xs text-gray-400 text-right">{total} sessioni totali</div>
    </div>
  )
}

const HOME_AWAY_LABEL: Record<string, string> = { home: 'Casa', away: 'Trasferta', neutral: 'Neutro' }
const MATCH_TYPE_LABEL: Record<string, string> = { campionato: 'Camp.', coppa: 'Coppa', amichevole: 'Amich.' }

function matchResult(m: PlayerMatchItem): { label: string; cls: string } | null {
  if (m.score_home == null || m.score_away == null) return null
  const diff = m.score_home - m.score_away
  if (diff > 0) return { label: 'V', cls: 'bg-green-100 text-green-700' }
  if (diff < 0) return { label: 'S', cls: 'bg-red-100 text-red-700' }
  return { label: 'P', cls: 'bg-yellow-100 text-yellow-700' }
}

function MatchesTab({ playerId }: { playerId: string }) {
  const [matches, setMatches] = useState<PlayerMatchItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlayerMatches(playerId)
      .then((res) => setMatches(res.data as PlayerMatchItem[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!matches.length) {
    return <div className="text-center text-gray-400 py-12 text-sm">Nessuna partita registrata</div>
  }

  const totMinutes = matches.reduce((s, m) => s + (m.minutes_played ?? 0), 0)
  const totGoals = matches.reduce((s, m) => s + (m.goals ?? 0), 0)
  const totAssists = matches.reduce((s, m) => s + (m.assists ?? 0), 0)
  const ratings = matches.filter((m) => m.rating != null).map((m) => m.rating as number)
  const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Partite', value: matches.length },
          { label: 'Minuti', value: totMinutes },
          { label: 'Gol', value: totGoals },
          { label: 'Assist', value: totAssists },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-2 text-center">
            <div className="text-lg font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {avgRating && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Voto medio</span>
          <span className="text-sm font-bold text-granata">{avgRating}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {matches.map((m) => {
          const result = matchResult(m)
          return (
            <div key={m.match_id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {result && (
                    <span className={`shrink-0 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${result.cls}`}>
                      {result.label}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">{m.opponent}</span>
                  <span className="text-xs text-gray-400 shrink-0">{MATCH_TYPE_LABEL[m.match_type] ?? m.match_type}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(m.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </div>
                  {m.score_home != null && m.score_away != null && (
                    <div className="text-xs font-semibold text-gray-700">{m.score_home}–{m.score_away}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {m.minutes_played != null && (
                  <span className="text-xs text-gray-500">⏱ {m.minutes_played}'</span>
                )}
                {(m.goals ?? 0) > 0 && (
                  <span className="text-xs text-gray-700">⚽ {m.goals}</span>
                )}
                {(m.assists ?? 0) > 0 && (
                  <span className="text-xs text-gray-700">🅰 {m.assists}</span>
                )}
                {(m.yellow_cards ?? 0) > 0 && (
                  <span className="text-xs">🟨 ×{m.yellow_cards}</span>
                )}
                {(m.red_cards ?? 0) > 0 && (
                  <span className="text-xs">🟥 ×{m.red_cards}</span>
                )}
                {m.rating != null && (
                  <span className="text-xs font-semibold text-granata ml-auto">{m.rating.toFixed(1)}</span>
                )}
                {m.position && (
                  <span className="text-xs text-gray-400">{HOME_AWAY_LABEL[m.home_away] ?? m.home_away} · {m.position}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PlayerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('anagrafica')
  const [assignments, setAssignments] = useState<PlayerAssignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [history, setHistory] = useState<PlayerHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [streak, setStreak] = useState<number | null>(null)
  const [summary, setSummary] = useState<PlayerSummary | null>(null)

  useEffect(() => {
    Promise.all([
      getPlayer(id!),
      getPlayerStreak(id!),
      getPlayerSummary(id!),
    ])
      .then(([playerRes, streakRes, summaryRes]) => {
        setPlayer(playerRes.data as Player)
        setStreak(streakRes.data.streak as number)
        setSummary(summaryRes.data as PlayerSummary)
      })
      .catch(() => setError('Giocatore non trovato'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (activeTab === 'gruppi' && !assignments.length) {
      setAssignmentsLoading(true)
      getPlayerAssignments(id!)
        .then((res) => setAssignments(res.data as PlayerAssignment[]))
        .catch(() => {})
        .finally(() => setAssignmentsLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab === 'trend' && !history.length) {
      setHistoryLoading(true)
      getPlayerHistory(id!)
        .then((res) => setHistory(res.data as PlayerHistoryItem[]))
        .catch(() => {})
        .finally(() => setHistoryLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!player) {
    return <div className="text-red-600 text-sm">{error || 'Giocatore non trovato'}</div>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/players')}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ←
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{player.last_name} {player.first_name}</h1>
            <AvailabilityBadge availability={player.availability} />
          </div>
          {player.current_group_name && (
            <div className="text-sm text-gray-500 mt-0.5">{player.current_group_name}</div>
          )}
        </div>
      </div>

      {/* Sommario stagionale */}
      {summary && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Partite</span>
            <span className="font-semibold text-gray-900">{summary.matches_played}</span>
            {summary.matches_played > 0 && (
              <span className="text-gray-500 text-xs">
                ⚽ {summary.goals} · 🅰 {summary.assists}
                {summary.avg_rating != null && ` · ⭐ ${summary.avg_rating.toFixed(1)}`}
              </span>
            )}
          </div>
          {summary.sessions_total > 0 && (
            <>
              <div className="h-4 w-px bg-gray-200 hidden sm:block" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Presenze</span>
                <span className="font-semibold text-gray-900">
                  {summary.attendance_pct != null ? `${summary.attendance_pct}%` : '—'}
                </span>
                <span className="text-gray-400 text-xs">({summary.sessions_present}/{summary.sessions_total})</span>
              </div>
            </>
          )}
          {summary.active_injury_type && (
            <>
              <div className="h-4 w-px bg-gray-200 hidden sm:block" />
              <div className="flex items-center gap-2 text-sm text-red-600">
                <span>Infortunio:</span>
                <span className="font-medium">{summary.active_injury_type}</span>
                {summary.active_injury_since && (
                  <span className="text-xs text-red-400">dal {fmtFull(summary.active_injury_since)}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'anagrafica', label: 'Anagrafica' },
          { key: 'gruppi',     label: 'Storico gruppi' },
          { key: 'trend',      label: 'Trend metriche' },
          { key: 'presenze',   label: 'Presenze' },
          { key: 'partite',    label: 'Partite' },
          { key: 'infortuni',  label: 'Infortuni' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-granata text-granata'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Anagrafica */}
      {activeTab === 'anagrafica' && (
        <div className="space-y-3">
          {streak != null && streak >= 2 && (
            <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              🔥 {streak} sessioni ottimo consecutive
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              { label: 'Cognome e nome', value: `${player.last_name} ${player.first_name}` },
              { label: 'Anno di nascita', value: player.birth_year ?? '—' },
              { label: 'Nazionalità', value: player.nationality ?? '—' },
              { label: 'Ruolo', value: player.position ?? '—' },
              { label: 'Piede', value: player.foot
                  ? player.foot.charAt(0).toUpperCase() + player.foot.slice(1)
                  : '—' },
              { label: 'N° maglia', value: player.jersey_number ?? '—' },
              { label: 'Telefono', value: player.phone ?? '—' },
              { label: 'Gruppo attuale', value: player.current_group_name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {player.notes && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Note</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{player.notes}</div>
            </div>
          )}

          <Link
            to={`/reports/player/${player.id}`}
            className="block w-full text-center bg-granata text-white py-2.5 rounded-xl text-sm font-medium hover:bg-granata-dark transition-colors mt-2"
          >
            Apri report completo
          </Link>
        </div>
      )}

      {/* Storico gruppi */}
      {activeTab === 'gruppi' && (
        <GroupsTimeline assignments={assignments} loading={assignmentsLoading} />
      )}

      {/* Trend metriche */}
      {activeTab === 'trend' && (
        <MetricsTrend history={history} loading={historyLoading} />
      )}

      {/* Presenze */}
      {activeTab === 'presenze' && (
        <AttendanceTab playerId={id!} />
      )}

      {/* Partite */}
      {activeTab === 'partite' && (
        <MatchesTab playerId={id!} />
      )}

      {/* Infortuni */}
      {activeTab === 'infortuni' && (
        <InjuryTab playerId={id!} />
      )}
    </div>
  )
}
