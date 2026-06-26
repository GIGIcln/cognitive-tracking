import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { exportReportPDF, exportPlayerCSV } from '../utils/exportUtils'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
} from 'recharts'
import { ChartErrorBoundary } from '../components/ErrorBoundary'
import ScoreWidget from '../components/ScoreWidget'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateShort } from '../utils/dateUtils'
import { LINE_COLORS, generateComment, linearRegression } from '../utils/reportUtils'
import { usePlayerReport } from '../hooks/usePlayerReport'

const PARAMS = COGNITIVE_PARAMS
const PLAYER_FIELD_KEYS = ['scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm']

function RankBadge({ ranking }) {
  if (!ranking || ranking.total < 2) return null
  const { rank, total, percentile } = ranking
  const cls =
    percentile >= 75 ? 'bg-emerald-500 text-white' :
    percentile >= 50 ? 'bg-blue-500 text-white' :
    percentile >= 25 ? 'bg-amber-400 text-white' :
    'bg-red-500 text-white'
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${cls}`}>
      {rank}°/{total}
    </span>
  )
}

function StatusDot({ val, target }) {
  const cls =
    val == null || !target ? 'bg-gray-200' :
    val >= target.ottimo_min ? 'bg-emerald-500' :
    val <= target.insufficient_max ? 'bg-red-500' :
    'bg-amber-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
}

function DeltaBadge({ pct }) {
  if (pct == null) return <span className="text-gray-300 text-xs">—</span>
  const cls = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-red-500' : 'text-gray-400'
  return (
    <span className={`text-xs font-bold ${cls}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function PlayerReportPage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const {
    playerName,
    playerFirstName,
    playerLastName,
    playerPosition,
    history,
    targets,
    sessionAverages,
    playerRanking,
    loading,
    error,
  } = usePlayerReport(playerId)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [hiddenLines, setHiddenLines] = useState({})
  const [sessionLimit, setSessionLimit] = useState('all')
  const [sessionTypeFilter, setSessionTypeFilter] = useState('all')

  const lastSession = history.length > 0 ? history[history.length - 1] : null

  const targetsMap = useMemo(
    () => Object.fromEntries(targets.map((t) => [t.parameter, t])),
    [targets]
  )

  const radarData = useMemo(
    () => PARAMS.map(({ field, label, italianLabel }) => ({
      subject: italianLabel,
      Giocatore: lastSession?.[field] ?? 0,
      'Target ottimo': targetsMap[label]?.ottimo_min ?? 0,
      fullMark: 10,
    })),
    [lastSession, targetsMap]
  )

  const compData = useMemo(
    () => PARAMS.map(({ field, label, avgKey }) => ({
      name: label,
      Giocatore: lastSession?.[field],
      'Media squadra': sessionAverages?.[avgKey],
    })),
    [lastSession, sessionAverages]
  )

  const comment =
    lastSession && targets.length
      ? generateComment(playerName, lastSession, targets, history, PLAYER_FIELD_KEYS)
      : null

  const sessionDate = lastSession?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const availableTypes = useMemo(
    () => [...new Set(history.map((h) => h.session_type))],
    [history]
  )

  const filteredHistory = useMemo(() => {
    let h = sessionTypeFilter === 'all' ? history : history.filter((s) => s.session_type === sessionTypeFilter)
    if (sessionLimit !== 'all') h = h.slice(-parseInt(sessionLimit))
    return h
  }, [history, sessionLimit, sessionTypeFilter])

  const deltaMap = useMemo(() => {
    if (filteredHistory.length < 2) return {}
    const first = filteredHistory[0]
    const last = filteredHistory[filteredHistory.length - 1]
    return Object.fromEntries(
      PARAMS.map(({ field }) => {
        const a = first[field]
        const b = last[field]
        if (a == null || b == null || a === 0) return [field, null]
        return [field, ((b - a) / a) * 100]
      })
    )
  }, [filteredHistory])

  const { lineData, hasRegression } = useMemo(() => {
    const xs = filteredHistory.map((_, i) => i)
    const avgValues = filteredHistory.map((h) => {
      const vals = PARAMS.map(({ field }) => h[field]).filter((v) => v != null)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    })
    const validXs = xs.filter((_, i) => avgValues[i] != null)
    const validYs = avgValues.filter((v) => v != null)
    const reg = linearRegression(validXs, validYs)
    const data = filteredHistory.map((h, i) => ({
      date: formatDateShort(h.session_date),
      ...Object.fromEntries(PARAMS.map(({ field, label }) => [label, h[field]])),
      ...(reg ? { Trend: parseFloat((reg.slope * i + reg.intercept).toFixed(2)) } : {}),
    }))
    return { lineData: data, hasRegression: reg !== null }
  }, [filteredHistory])

  const avgInsufficient = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.insufficient_max, 0) / targets.length : null,
    [targets]
  )
  const avgOttimo = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.ottimo_min, 0) / targets.length : null,
    [targets]
  )

  const handleLegendClick = (data) => {
    setHiddenLines((prev) => ({ ...prev, [data.dataKey]: !prev[data.dataKey] }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-granata hover:underline">
          ← Torna indietro
        </button>
      </div>
    )
  }

  return (
    <div id="report-content" className="space-y-4 pb-8">

      {/* ── HERO HEADER ── */}
      <div className="bg-gray-900 rounded-2xl p-5 text-white relative overflow-hidden report-section">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-granata rounded-l-2xl" />
        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="flex items-start gap-3 min-w-0">
            <button
              id="report-back-btn"
              onClick={() => navigate('/reports')}
              className="text-gray-400 hover:text-white shrink-0 text-lg mt-0.5 transition-colors"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Report Individuale
              </div>
              <h1 className="text-xl sm:text-2xl font-black mt-0.5 break-words">
                {playerName || 'Giocatore'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {playerPosition && (
                  <span className="text-[10px] font-black bg-granata px-2 py-0.5 rounded uppercase tracking-widest">
                    {playerPosition}
                  </span>
                )}
                {lastSession && (
                  <span className="text-xs text-gray-400">
                    {lastSession.group_name} · {formatDateShort(lastSession.session_date)} · {lastSession.session_type}
                  </span>
                )}
                <RankBadge ranking={playerRanking} />
              </div>
            </div>
          </div>
          <div id="export-buttons" className="flex gap-2 shrink-0">
            <button
              onClick={async () => {
                setPdfLoading(true)
                await exportReportPDF(
                  `/reports/player/${playerId}/pdf`,
                  `report_${playerLastName}_${playerFirstName}_${sessionDate}.pdf`
                )
                setPdfLoading(false)
              }}
              disabled={pdfLoading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              onClick={() => exportPlayerCSV(playerName, history, targets)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Nessuna sessione disponibile per questo giocatore.
        </div>
      ) : (
        <>
          {/* ── SCORE WIDGETS ── */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 report-section">
            {PARAMS.map(({ field, label, italianLabel }) => (
              <ScoreWidget
                key={field}
                code={label}
                label={italianLabel}
                value={lastSession?.[field]}
                target={targetsMap[label]}
                delta={deltaMap[field]}
              />
            ))}
          </div>

          {/* ── PROFILO COGNITIVO + TABELLA ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ultima sessione</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">Profilo Cognitivo vs Target</div>
              </div>
              {lastSession && (
                <div className="text-xs text-gray-400 text-right shrink-0 ml-2">
                  {formatDateShort(lastSession.session_date)}<br />
                  <span className="text-gray-300">{lastSession.session_type}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              <ChartErrorBoundary height={260}>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid gridType="polygon" stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
                    <Radar
                      name="Giocatore"
                      dataKey="Giocatore"
                      fill="#3B82F6"
                      fillOpacity={0.4}
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                    <Radar
                      name="Target ottimo"
                      dataKey="Target ottimo"
                      fill="#8B1A2E"
                      fillOpacity={0.15}
                      stroke="#8B1A2E"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="pb-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Parametro
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Valore
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Target
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Δ
                    </th>
                    <th className="pb-2 w-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {PARAMS.map(({ field, label, italianLabel }) => {
                    const val = lastSession[field]
                    const t = targetsMap[label]
                    const rowBg =
                      val == null || !t ? '' :
                      val >= t.ottimo_min ? 'bg-emerald-50' :
                      val <= t.insufficient_max ? 'bg-red-50' :
                      'bg-amber-50'
                    return (
                      <tr key={field} className={rowBg}>
                        <td className="py-2.5 text-gray-700 font-medium">{italianLabel}</td>
                        <td className="py-2.5 text-right font-black text-gray-900 tabular-nums">
                          {val != null ? val.toFixed(1) : (
                            <span className="text-gray-300 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-gray-400 tabular-nums">
                          {t ? t.ottimo_min.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <DeltaBadge pct={deltaMap[field]} />
                        </td>
                        <td className="py-2.5 text-right pl-1">
                          <StatusDot val={val} target={t} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ANDAMENTO NEL TEMPO ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Storico</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">Andamento nel tempo</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {['all', '5', '10'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSessionLimit(v)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                        sessionLimit === v
                          ? 'bg-white text-gray-800 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {v === 'all' ? 'Tutte' : `Ultime ${v}`}
                    </button>
                  ))}
                </div>
                {availableTypes.length > 1 && (
                  <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                    {['all', ...availableTypes].map((type) => (
                      <button
                        key={type}
                        onClick={() => setSessionTypeFilter(type)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                          sessionTypeFilter === type
                            ? 'bg-white text-gray-800 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {type === 'all' ? 'Tutti' : type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {filteredHistory.length < 2 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Servono almeno 2 sessioni per visualizzare il trend.
              </p>
            ) : (
              <ChartErrorBoundary height={260}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    />
                    <Legend
                      onClick={handleLegendClick}
                      style={{ cursor: 'pointer' }}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    {avgInsufficient != null && (
                      <ReferenceLine
                        y={avgInsufficient}
                        stroke="#EF4444"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}
                    {avgOttimo != null && (
                      <ReferenceLine
                        y={avgOttimo}
                        stroke="#10B981"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}
                    {PARAMS.map(({ label }, i) => (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={label}
                        stroke={LINE_COLORS[i]}
                        strokeWidth={2}
                        dot={lineData.length > 20 ? false : { r: 3, fill: LINE_COLORS[i] }}
                        activeDot={{ r: 5 }}
                        hide={!!hiddenLines[label]}
                      />
                    ))}
                    {hasRegression && (
                      <Line
                        type="linear"
                        dataKey="Trend"
                        stroke="#9CA3AF"
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                        dot={false}
                        activeDot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            )}
          </div>

          {/* ── VS MEDIA SQUADRA ── */}
          {sessionAverages && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <div className="mb-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confronto</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">vs Media squadra — ultima sessione</div>
              </div>
              <ChartErrorBoundary height={200}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={compData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Giocatore" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Media squadra" fill="#8B1A2E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>
          )}

          {/* ── ANALISI AUTOMATICA ── */}
          {comment && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <div className="mb-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analisi</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">Commento automatico</div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
