import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getPlayer, getPlayerHistory, getPlayerAssignments, getPlayerStreak } from '../api/players'

const METRICS = [
  { key: 'scanning_rate',    label: 'SR',  color: '#8b5cf6' },
  { key: 'decision_quality', label: 'DQI', color: '#3b82f6' },
  { key: 'anticipation',     label: 'AI',  color: '#10b981' },
  { key: 'transition_reset', label: 'TRS', color: '#f59e0b' },
  { key: 'verbal_comm',      label: 'VCI', color: '#ef4444' },
]

function fmt(d) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function fmtFull(d) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function GroupsTimeline({ assignments, loading }) {
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

function MetricsTrend({ history, loading }) {
  const [visible, setVisible] = useState(new Set(METRICS.map((m) => m.key)))

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

  const toggle = (key) =>
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
                return [v !== null ? v.toFixed(1) : '—', m?.label ?? name]
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

export default function PlayerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('anagrafica')
  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    Promise.all([
      getPlayer(id),
      getPlayerStreak(id),
    ])
      .then(([playerRes, streakRes]) => {
        setPlayer(playerRes.data)
        setStreak(streakRes.data.streak)
      })
      .catch(() => setError('Giocatore non trovato'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (activeTab === 'gruppi' && !assignments.length) {
      setAssignmentsLoading(true)
      getPlayerAssignments(id)
        .then((res) => setAssignments(res.data))
        .catch(() => {})
        .finally(() => setAssignmentsLoading(false))
    }
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab === 'trend' && !history.length) {
      setHistoryLoading(true)
      getPlayerHistory(id)
        .then((res) => setHistory(res.data))
        .catch(() => {})
        .finally(() => setHistoryLoading(false))
    }
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
          <h1 className="text-2xl font-bold text-gray-900">{player.last_name} {player.first_name}</h1>
          {player.current_group_name && (
            <div className="text-sm text-gray-500 mt-0.5">{player.current_group_name}</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'anagrafica', label: 'Anagrafica' },
          { key: 'gruppi',     label: 'Storico gruppi' },
          { key: 'trend',      label: 'Trend metriche' },
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
          {streak >= 2 && (
            <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              🔥 {streak} sessioni ottimo consecutive
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              { label: 'Nome', value: `${player.last_name} ${player.first_name}` },
              { label: 'Anno di nascita', value: player.birth_year ?? '—' },
              { label: 'Ruolo', value: player.position ?? '—' },
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
    </div>
  )
}
