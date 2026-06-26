import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { exportReportPDF, exportSessionPlayerCSV } from '../utils/exportUtils'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChartErrorBoundary } from '../components/ErrorBoundary'
import ScoreWidget from '../components/ScoreWidget'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateShort } from '../utils/dateUtils'
import { useSessionPlayerReport } from '../hooks/useSessionPlayerReport'

const PARAMS = COGNITIVE_PARAMS

function RankBadge({ ranking }: { ranking: { rank: number; total: number; percentile: number } | null | undefined }) {
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

function StatusDot({ val, target }: { val: number | null | undefined; target: { ottimo_min: number; insufficient_max: number } | null | undefined }) {
  const cls =
    val == null || !target ? 'bg-gray-200' :
    val >= target.ottimo_min ? 'bg-emerald-500' :
    val <= target.insufficient_max ? 'bg-red-500' :
    'bg-amber-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
}

export default function SessionPlayerReportPage() {
  const { sessionId, playerId } = useParams()
  const navigate = useNavigate()
  const {
    session,
    groupName,
    playerName,
    playerFirstName,
    playerLastName,
    playerPosition,
    measurement,
    averages,
    playerRanking,
    targets,
    loading,
    error,
  } = useSessionPlayerReport(sessionId!, playerId!)
  const [pdfLoading, setPdfLoading] = useState(false)

  const targetsMap = useMemo(
    () => Object.fromEntries(targets.map((t) => [t.parameter, t])),
    [targets]
  )

  const radarData = useMemo(
    () => PARAMS.map(({ field, label, italianLabel }) => ({
      subject: italianLabel,
      Giocatore: measurement?.[field] ?? 0,
      'Target ottimo': targetsMap[label]?.ottimo_min ?? 0,
      fullMark: 10,
    })),
    [measurement, targetsMap]
  )

  const compData = useMemo(
    () => PARAMS.map(({ field, label, avgKey }) => ({
      name: label,
      Giocatore: measurement?.[field],
      'Media squadra': averages?.[avgKey],
    })),
    [measurement, averages]
  )

  const sessionDate = session?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

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

  if (!measurement || measurement.is_absent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-4">
          {measurement?.is_absent
            ? 'Il giocatore era assente in questa sessione.'
            : 'Nessuna misurazione trovata per questo giocatore in questa sessione.'}
        </p>
        <button
          onClick={() => navigate(`/reports/session/${sessionId}`)}
          className="text-sm text-granata hover:underline"
        >
          ← Torna al report squadra
        </button>
      </div>
    )
  }

  return (
    <div id="report-content" className="space-y-4 pb-8">

      {/* HERO HEADER */}
      <div className="bg-gray-900 rounded-2xl p-5 text-white relative overflow-hidden report-section">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-granata rounded-l-2xl" />
        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="flex items-start gap-3 min-w-0">
            <button
              id="report-back-btn"
              onClick={() => navigate(`/reports/session/${sessionId}`)}
              className="text-gray-400 hover:text-white shrink-0 text-lg mt-0.5 transition-colors"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Report Sessione · Individuale
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
                {session && (
                  <span className="text-xs text-gray-400">
                    {groupName} · {formatDateShort(session.session_date)} · {session.session_type}
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
                  `/reports/session/${sessionId}/player/${playerId}/pdf`,
                  `report_sessione_${playerLastName}_${playerFirstName}_${sessionDate}.pdf`
                )
                setPdfLoading(false)
              }}
              disabled={pdfLoading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              onClick={() =>
                exportSessionPlayerCSV(
                  playerLastName, playerFirstName, session, groupName, measurement as unknown as Record<string, unknown>, averages, targets
                )
              }
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* SCORE WIDGETS */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3 report-section">
        {PARAMS.map(({ field, label, italianLabel }) => (
          <ScoreWidget
            key={field}
            code={label}
            label={italianLabel}
            value={(measurement as unknown as Record<string, number | null> | null)?.[field]}
            target={targetsMap[label]}
          />
        ))}
      </div>

      {/* PROFILO COGNITIVO VS TARGET */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sessione</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">Profilo Cognitivo vs Target</div>
          </div>
          {session && (
            <div className="text-xs text-gray-400 text-right shrink-0 ml-2">
              {formatDateShort(session.session_date)}<br />
              <span className="text-gray-300">{session.session_type}</span>
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
                <th className="pb-2 w-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PARAMS.map(({ field, label, italianLabel }) => {
                const val = (measurement as unknown as Record<string, number | null> | null)?.[field]
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

      {/* VS MEDIA SQUADRA */}
      {averages && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="mb-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confronto</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">vs Media squadra — questa sessione</div>
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
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Giocatore" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Media squadra" fill="#8B1A2E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartErrorBoundary>
        </div>
      )}

      {/* NOTE GIOCATORE */}
      {measurement?.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="mb-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Note</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">Osservazioni sessione</div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {measurement?.notes}
          </p>
        </div>
      )}
    </div>
  )
}
