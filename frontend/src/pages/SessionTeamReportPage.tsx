import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { exportReportPDF, exportSessionTeamCSV } from '../utils/exportUtils'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import ParamCard from '../components/ParamCard'
import ScoreWidget from '../components/ScoreWidget'
import { ChartErrorBoundary } from '../components/ErrorBoundary'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateShort } from '../utils/dateUtils'
import { generateComment } from '../utils/reportUtils'
import { useSessionTeamReport } from '../hooks/useSessionTeamReport'
import type { Target } from '../types/api'

const PARAMS = COGNITIVE_PARAMS
const TEAM_FIELD_KEYS = ['avg_sr', 'avg_dqi', 'avg_ai', 'avg_trs', 'avg_vci']

function cellClass(val: number | null | undefined, target: Target | null | undefined) {
  if (val == null || !target) return 'text-gray-400'
  if (val >= target.ottimo_min) return 'bg-emerald-50 text-emerald-800 font-semibold'
  if (val <= target.insufficient_max) return 'bg-red-50 text-red-800 font-semibold'
  return 'bg-amber-50 text-amber-800 font-semibold'
}

function StatusDot({ val, target }: { val: number | null | undefined; target: Target | null | undefined }) {
  const cls =
    val == null || !target ? 'bg-gray-200' :
    val >= target.ottimo_min ? 'bg-emerald-500' :
    val <= target.insufficient_max ? 'bg-red-500' :
    'bg-amber-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
}

export default function SessionTeamReportPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { session, groupName, measurements, averages, targets, loading, error } =
    useSessionTeamReport(sessionId!)
  const [pdfLoading, setPdfLoading] = useState(false)

  const targetsMap = useMemo(
    () => Object.fromEntries(targets.map((t) => [t.parameter, t])),
    [targets]
  )

  const presentMeasurements = useMemo(
    () => measurements.filter((m) => !m.is_absent),
    [measurements]
  )

  const playerRankings = useMemo(
    () => presentMeasurements
      .map((m) => {
        const values = PARAMS.map((p) => m[p.field]).filter((v) => v != null)
        const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
        return { ...m, avg }
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)),
    [presentMeasurements]
  )

  const radarData = useMemo(
    () => PARAMS.map(({ label, italianLabel, avgKey }) => ({
      subject: italianLabel,
      'Media squadra': averages?.[avgKey] ?? 0,
      'Target ottimo': targetsMap[label]?.ottimo_min ?? 0,
      fullMark: 10,
    })),
    [averages, targetsMap]
  )

  const avgInsufficient = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.insufficient_max, 0) / targets.length : null,
    [targets]
  )
  const avgOttimo = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.ottimo_min, 0) / targets.length : null,
    [targets]
  )

  function avgCellClass(val: number | null) {
    if (val == null || avgInsufficient == null || avgOttimo == null) return 'text-gray-400'
    if (val >= avgOttimo) return 'bg-emerald-50 text-emerald-800 font-bold'
    if (val <= avgInsufficient) return 'bg-red-50 text-red-800 font-bold'
    return 'bg-amber-50 text-amber-800 font-bold'
  }

  const comment = useMemo(
    () => averages && targets.length
      ? generateComment('La squadra', averages, targets, [averages], TEAM_FIELD_KEYS)
      : null,
    [averages, targets]
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

  return (
    <div id="report-content" className="space-y-4 pb-8">

      {/* HERO HEADER */}
      <div className="bg-gray-900 rounded-2xl p-5 text-white relative overflow-hidden report-section">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-granata rounded-l-2xl" />
        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="flex items-start gap-3 min-w-0">
            <button
              id="report-back-btn"
              onClick={() => navigate(`/sessions/${sessionId}`)}
              className="text-gray-400 hover:text-white shrink-0 text-lg mt-0.5 transition-colors"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Report Sessione
              </div>
              <h1 className="text-xl sm:text-2xl font-black mt-0.5 break-words">
                {groupName || 'Squadra'}
              </h1>
              {session && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">
                    {formatDateShort(session.session_date)} · {session.session_type}
                    {session.duration_min ? ` · ${session.duration_min} min` : ''}
                  </span>
                  {averages && (
                    <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded">
                      {averages.player_count} giocatori
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div id="export-buttons" className="flex gap-2 shrink-0">
            <button
              onClick={async () => {
                setPdfLoading(true)
                await exportReportPDF(
                  'report-content',
                  `report_sessione_${groupName.replace(/\s/g, '_')}_${sessionDate}.pdf`
                )
                setPdfLoading(false)
              }}
              disabled={pdfLoading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              onClick={() => exportSessionTeamCSV(session, groupName, playerRankings, averages, targets)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* SCORE WIDGETS */}
      {averages && (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3 report-section">
          {PARAMS.map(({ label, italianLabel, avgKey }) => (
            <ScoreWidget
              key={label}
              code={label}
              label={italianLabel}
              value={averages[avgKey]}
              target={targetsMap[label]}
            />
          ))}
        </div>
      )}

      {/* PROFILO COGNITIVO VS TARGET */}
      {averages && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Sessione
              </div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">Media squadra vs Target</div>
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
                    name="Media squadra"
                    dataKey="Media squadra"
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
                    Media
                  </th>
                  <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Target
                  </th>
                  <th className="pb-2 w-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {PARAMS.map(({ label, italianLabel, avgKey }) => {
                  const val = averages[avgKey]
                  const t = targetsMap[label]
                  const rowBg =
                    val == null || !t ? '' :
                    val >= t.ottimo_min ? 'bg-emerald-50' :
                    val <= t.insufficient_max ? 'bg-red-50' :
                    'bg-amber-50'
                  return (
                    <tr key={label} className={rowBg}>
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
      )}

      {/* CLASSIFICA GIOCATORI */}
      {playerRankings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="mb-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Classifica
            </div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">
              Giocatori — questa sessione
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="pb-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide w-6">
                    #
                  </th>
                  <th className="pb-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pl-2">
                    Giocatore
                  </th>
                  {PARAMS.map(({ label }) => (
                    <th
                      key={label}
                      className="pb-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="pb-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Media
                  </th>
                  <th className="pb-2 w-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {playerRankings.map((m, i) => (
                  <tr
                    key={m.player_id}
                    className={
                      i === 0 ? 'bg-amber-50' :
                      i === 1 ? 'bg-slate-50' :
                      i === 2 ? 'bg-orange-50' :
                      i % 2 === 1 ? 'bg-gray-50/50' : ''
                    }
                  >
                    <td className="py-2 text-center">
                      <span className={
                        i === 0 ? 'text-sm font-black text-amber-500' :
                        i === 1 ? 'text-sm font-black text-slate-400' :
                        i === 2 ? 'text-sm font-black text-orange-400' :
                        'text-xs text-gray-400'
                      }>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-gray-800 pl-2 whitespace-nowrap">
                      <button
                        className="hover:text-granata transition-colors text-left"
                        onClick={() =>
                          navigate(`/reports/session/${sessionId}/player/${m.player_id}`)
                        }
                      >
                        {m.last_name} {m.first_name}
                      </button>
                    </td>
                    {PARAMS.map(({ field, label }) => (
                      <td
                        key={field}
                        className={`py-1.5 text-center text-xs rounded ${cellClass(m[field], targetsMap[label])}`}
                      >
                        {m[field] != null ? m[field].toFixed(1) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    ))}
                    <td className={`py-1.5 text-center text-xs rounded ${avgCellClass(m.avg)}`}>
                      {m.avg != null ? m.avg.toFixed(1) : (
                        <span className="text-gray-200 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-1">
                      <button
                        onClick={() =>
                          navigate(`/reports/session/${sessionId}/player/${m.player_id}`)
                        }
                        className="text-gray-300 hover:text-granata transition-colors"
                        title="Report giocatore"
                      >
                        →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISTRIBUZIONE PER PARAMETRO */}
      {presentMeasurements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="mb-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Distribuzione
            </div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">Dettaglio per parametro</div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {PARAMS.slice(0, 3).map(({ field, label, italianLabel }) => (
                <ParamCard
                  key={field}
                  field={field}
                  italianLabel={italianLabel}
                  target={targetsMap[label]}
                  measurements={presentMeasurements}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-[66%] mx-auto">
              {PARAMS.slice(3).map(({ field, label, italianLabel }) => (
                <ParamCard
                  key={field}
                  field={field}
                  italianLabel={italianLabel}
                  target={targetsMap[label]}
                  measurements={presentMeasurements}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ANALISI AUTOMATICA */}
      {comment && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
          <div className="mb-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analisi</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">Commento automatico</div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
        </div>
      )}
    </div>
  )
}
