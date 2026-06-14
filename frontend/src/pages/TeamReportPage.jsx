import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import { getGroup, getGroupHistory, getGroupTargets } from '../api/groups'

const PARAMS = [
  { field: 'scanning_rate',    label: 'SR',  italianLabel: 'Scanning Rate',  avgKey: 'avg_sr'  },
  { field: 'decision_quality', label: 'DQI', italianLabel: 'Dec. Quality',   avgKey: 'avg_dqi' },
  { field: 'anticipation',     label: 'AI',  italianLabel: 'Anticipazione',  avgKey: 'avg_ai'  },
  { field: 'transition_reset', label: 'TRS', italianLabel: 'Trans. Reset',   avgKey: 'avg_trs' },
  { field: 'verbal_comm',      label: 'VCI', italianLabel: 'Comunicazione',  avgKey: 'avg_vci' },
]

const LINE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

const formatDate = (d) =>
  new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

function badge(val, target) {
  if (val == null || !target) return null
  if (val >= target.ottimo_min) return '🟢'
  if (val <= target.insufficient_max) return '🔴'
  return '🟡'
}

function generateTeamComment(lastEntry, targets, history) {
  const paramFields = ['scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm']
  const avgKeys = ['avg_sr', 'avg_dqi', 'avg_ai', 'avg_trs', 'avg_vci']
  const labels = ['SR', 'DQI', 'AI', 'TRS', 'VCI']
  const italianLabels = [
    'Scanning Rate', 'Decision Quality', 'Anticipazione',
    'Transition Reset', 'Comunicazione Verbale',
  ]

  const strong = [], weak = [], sufficient = []
  avgKeys.forEach((ak, i) => {
    const val = lastEntry[ak]
    const t = targets.find((t) => t.parameter === labels[i])
    if (!val || !t) return
    if (val >= t.ottimo_min) strong.push(italianLabels[i])
    else if (val <= t.insufficient_max) weak.push(italianLabels[i])
    else sufficient.push(italianLabels[i])
  })

  let trendText = ''
  if (history.length >= 2) {
    const prev = history[history.length - 2]
    const curr = history[history.length - 1]
    const avgPrev = avgKeys.reduce((s, k) => s + (prev[k] || 0), 0) / avgKeys.length
    const avgCurr = avgKeys.reduce((s, k) => s + (curr[k] || 0), 0) / avgKeys.length
    const diff = (avgCurr - avgPrev).toFixed(1)
    if (diff > 0) trendText = `Trend generale in miglioramento (+${diff} punti medi).`
    else if (diff < 0) trendText = `Trend generale in calo (${diff} punti medi).`
    else trendText = `Trend generale stabile.`
  }

  let comment = `La squadra: `
  if (strong.length) comment += `Ottimo su ${strong.join(', ')}. `
  if (sufficient.length) comment += `Sufficiente su ${sufficient.join(', ')}. `
  if (weak.length) comment += `Insufficiente su ${weak.join(', ')} — area prioritaria. `
  if (trendText) comment += trendText
  return comment
}

export default function TeamReportPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [groupName, setGroupName] = useState('')
  const [history, setHistory] = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hiddenLines, setHiddenLines] = useState({})

  useEffect(() => {
    Promise.all([getGroup(groupId), getGroupHistory(groupId), getGroupTargets(groupId)])
      .then(([gr, hist, tgt]) => {
        setGroupName(gr.data.name)
        setHistory(hist.data ?? [])
        setTargets(tgt.data ?? [])
      })
      .catch(() => setError('Errore nel caricamento del report'))
      .finally(() => setLoading(false))
  }, [groupId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>
  }

  const lastEntry = history.length > 0 ? history[history.length - 1] : null
  const targetsMap = Object.fromEntries(targets.map((t) => [t.parameter, t]))

  const barData = PARAMS.map(({ label, italianLabel, avgKey }) => ({
    name: label,
    'Media squadra': lastEntry?.[avgKey],
    'Target ottimo': targetsMap[label]?.ottimo_min,
  }))

  const lineData = history.map((h) => ({
    date: formatDate(h.session_date),
    SR: h.avg_sr,
    DQI: h.avg_dqi,
    AI: h.avg_ai,
    TRS: h.avg_trs,
    VCI: h.avg_vci,
  }))

  const avgInsufficient =
    targets.length
      ? targets.reduce((s, t) => s + t.insufficient_max, 0) / targets.length
      : null
  const avgOttimo =
    targets.length
      ? targets.reduce((s, t) => s + t.ottimo_min, 0) / targets.length
      : null

  const handleLegendClick = (data) => {
    const key = data.dataKey
    setHiddenLines((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const comment =
    lastEntry && targets.length
      ? generateTeamComment(lastEntry, targets, history)
      : null

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{groupName || 'Squadra'}</h1>
            <div className="text-sm text-gray-500 mt-0.5">Report squadra</div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => alert('Export disponibile nella prossima versione')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            📄 Esporta PDF
          </button>
          <button
            onClick={() => alert('Export disponibile nella prossima versione')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            📊 Esporta CSV
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Nessuna sessione disponibile per questo gruppo.
        </div>
      ) : (
        <>
          {/* SEZIONE 1 — Ultima sessione: Media squadra vs Target */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Ultima sessione — Media squadra vs Target
            </h2>
            <div className="text-xs text-gray-400 mb-4">
              {formatDate(lastEntry.session_date)} · {lastEntry.session_type} ·{' '}
              {lastEntry.player_count} giocatori
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Media squadra" fill="#8B1A2E" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Target ottimo" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Parametro</th>
                  <th className="pb-2 font-medium text-right">Media squadra</th>
                  <th className="pb-2 font-medium text-right">Target ottimo</th>
                  <th className="pb-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {PARAMS.map(({ label, italianLabel, avgKey }) => {
                  const val = lastEntry?.[avgKey]
                  const t = targetsMap[label]
                  return (
                    <tr key={label} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-700">{italianLabel}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        {val != null ? val.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {t ? t.ottimo_min.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 text-right">{badge(val, t)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* SEZIONE 2 — Andamento squadra nel tempo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Andamento squadra nel tempo
            </h2>
            {history.length < 2 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Servono almeno 2 sessioni per visualizzare il trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={lineData}
                  margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend onClick={handleLegendClick} style={{ cursor: 'pointer' }} />
                  {avgInsufficient != null && (
                    <ReferenceLine
                      y={avgInsufficient}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  {avgOttimo != null && (
                    <ReferenceLine
                      y={avgOttimo}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  {PARAMS.map(({ label }, i) => (
                    <Line
                      key={label}
                      type="monotone"
                      dataKey={label}
                      stroke={LINE_COLORS[i]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      hide={!!hiddenLines[label]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* SEZIONE 3 — Commento squadra */}
          {comment && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Commento squadra
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
