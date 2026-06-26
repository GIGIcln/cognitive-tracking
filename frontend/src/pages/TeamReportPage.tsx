import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { exportReportPDF, exportTeamCSV } from '../utils/exportUtils'
import {
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
import ParamCard from '../components/ParamCard'
import ScoreWidget from '../components/ScoreWidget'
import { ChartErrorBoundary } from '../components/ErrorBoundary'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateShort } from '../utils/dateUtils'
import { LINE_COLORS, generateComment } from '../utils/reportUtils'
import { useTeamReport } from '../hooks/useTeamReport'

const PARAMS = COGNITIVE_PARAMS
const TEAM_FIELD_KEYS = ['avg_sr', 'avg_dqi', 'avg_ai', 'avg_trs', 'avg_vci']

import type { Target, GroupHistoryItem, Measurement } from '../types/api'

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

export default function TeamReportPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { groupName, history, targets, measurements, loading, error } = useTeamReport(groupId!)
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [pdfLoading, setPdfLoading] = useState(false)

  // All hooks must be called before any early return
  const lastEntry = history.length > 0 ? history[history.length - 1] : null

  const targetsMap = useMemo(
    () => Object.fromEntries(targets.map((t: Target) => [t.parameter, t])),
    [targets]
  )

  const lineData = useMemo(
    () => history.map((h: GroupHistoryItem) => ({
      date: formatDateShort(h.session_date),
      SR: h.avg_sr,
      DQI: h.avg_dqi,
      AI: h.avg_ai,
      TRS: h.avg_trs,
      VCI: h.avg_vci,
    })),
    [history]
  )

  const avgInsufficient = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.insufficient_max, 0) / targets.length : null,
    [targets]
  )
  const avgOttimo = useMemo(
    () => targets.length ? targets.reduce((s, t) => s + t.ottimo_min, 0) / targets.length : null,
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

  const comment = useMemo(
    () => lastEntry && targets.length
      ? generateComment('La squadra', lastEntry as unknown as Record<string, number | null | undefined>, targets, history as unknown as Record<string, number | null | undefined>[], TEAM_FIELD_KEYS)
      : null,
    [lastEntry, targets, history]
  )

  const sessionDate = lastEntry?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const handleLegendClick = (data: { dataKey?: string }) => {
    if (data.dataKey) setHiddenLines((prev) => ({ ...prev, [data.dataKey!]: !prev[data.dataKey!] }))
  }

  function avgCellClass(val: number | null | undefined) {
    if (val == null || avgInsufficient == null || avgOttimo == null) return 'text-gray-400'
    if (val >= avgOttimo) return 'bg-emerald-50 text-emerald-800 font-bold'
    if (val <= avgInsufficient) return 'bg-red-50 text-red-800 font-bold'
    return 'bg-amber-50 text-amber-800 font-bold'
  }

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
                Report Squadra
              </div>
              <h1 className="text-xl sm:text-2xl font-black mt-0.5 break-words">
                {groupName || 'Squadra'}
              </h1>
              {lastEntry && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">
                    {formatDateShort(lastEntry.session_date)} · {lastEntry.session_type}
                  </span>
                  <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded">
                    {lastEntry.player_count} giocatori
                  </span>
                </div>
              )}
            </div>
          </div>
          <div id="export-buttons" className="flex gap-2 shrink-0">
            <button
              onClick={async () => {
                setPdfLoading(true)
                await exportReportPDF(
                  `/reports/team/${groupId}/pdf`,
                  `report_squadra_${groupName.replace(/\s/g, '_')}_${sessionDate}.pdf`
                )
                setPdfLoading(false)
              }}
              disabled={pdfLoading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              onClick={() => exportTeamCSV(groupName, history, playerRankings, targets)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Nessuna sessione disponibile per questo gruppo.
        </div>
      ) : (
        <>
          {/* ── SCORE WIDGETS — medie squadra ── */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 report-section">
            {PARAMS.map(({ label, italianLabel, avgKey }) => (
              <ScoreWidget
                key={label}
                code={label}
                label={italianLabel}
                value={(lastEntry as unknown as Record<string, number | null>)?.[avgKey]}
                target={targetsMap[label]}
              />
            ))}
          </div>

          {/* ── MEDIA SQUADRA VS TARGET ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Ultima sessione
                </div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">Media squadra vs Target</div>
              </div>
              {lastEntry && (
                <div className="text-xs text-gray-400 text-right shrink-0 ml-2">
                  {formatDateShort(lastEntry.session_date)}<br />
                  <span className="text-gray-300">{lastEntry.session_type}</span>
                </div>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="pb-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Parametro
                  </th>
                  <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Media squadra
                  </th>
                  <th className="pb-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Target
                  </th>
                  <th className="pb-2 w-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {PARAMS.map(({ label, italianLabel, avgKey }) => {
                  const val = (lastEntry as unknown as Record<string, number | null>)?.[avgKey]
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

          {/* ── CLASSIFICA GIOCATORI ── */}
          {presentMeasurements.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <div className="mb-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Classifica
                </div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">
                  Giocatori — ultima sessione
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
                          {m.last_name} {m.first_name}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DETTAGLIO PER PARAMETRO ── */}
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

          {/* ── ANDAMENTO SQUADRA ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <div className="mb-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Storico</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">Andamento squadra nel tempo</div>
            </div>
            {history.length < 2 ? (
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
                      onClick={handleLegendClick as unknown as () => void}
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
                  </LineChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            )}
          </div>

          {/* ── ANALISI SQUADRA ── */}
          {comment && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <div className="mb-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analisi</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">Commento squadra</div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
