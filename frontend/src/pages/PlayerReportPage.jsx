import { useState, useEffect, useMemo } from 'react'
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
import { getPlayer, getPlayerHistory } from '../api/players'
import { getGroupTargets } from '../api/groups'
import { getSessionAverages } from '../api/sessions'
import { COGNITIVE_PARAMS } from '../constants/domain'
import { formatDateShort } from '../utils/dateUtils'
import { LINE_COLORS, badge, generateComment } from '../utils/reportUtils'

const PARAMS = COGNITIVE_PARAMS

const PLAYER_FIELD_KEYS = ['scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm']

export default function PlayerReportPage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const [playerFirstName, setPlayerFirstName] = useState('')
  const [playerLastName, setPlayerLastName] = useState('')
  const [history, setHistory] = useState([])
  const [targets, setTargets] = useState([])
  const [sessionAverages, setSessionAverages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [hiddenLines, setHiddenLines] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const [playerRes, historyRes] = await Promise.all([
          getPlayer(playerId),
          getPlayerHistory(playerId),
        ])

        const hist = historyRes.data
        setHistory(hist)

        const { first_name, last_name } = playerRes.data
        setPlayerName(`${first_name} ${last_name}`)
        setPlayerFirstName(first_name)
        setPlayerLastName(last_name)

        if (hist.length > 0) {
          const last = hist[hist.length - 1]
          const [targetsRes, avgRes] = await Promise.all([
            getGroupTargets(last.group_id),
            getSessionAverages(last.session_id),
          ])
          setTargets(targetsRes.data ?? [])
          setSessionAverages(avgRes.data)
        }
      } catch {
        setError('Errore nel caricamento del report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [playerId])

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

  const lineData = useMemo(
    () => history.map((h) => ({
      date: formatDateShort(h.session_date),
      ...Object.fromEntries(PARAMS.map(({ field, label }) => [label, h[field]])),
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

  const handleLegendClick = (data) => {
    setHiddenLines((prev) => ({ ...prev, [data.dataKey]: !prev[data.dataKey] }))
  }

  return (
    <div id="report-content" className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
          >
            ←
          </button>
          <div className="report-header">
            <h1 className="text-xl font-bold text-gray-900">
              {playerName || 'Giocatore'}
            </h1>
            <div className="text-sm text-gray-500 mt-0.5">Report individuale</div>
          </div>
        </div>
        <div id="export-buttons" className="flex gap-2 shrink-0">
          <button
            onClick={async () => {
              setPdfLoading(true)
              await exportReportPDF(
                'report-content',
                `report_${playerLastName}_${playerFirstName}_${sessionDate}.pdf`,
                `${playerLastName} ${playerFirstName}`,
                lastSession
                  ? `Report individuale · ${sessionDate} · ${lastSession.group_name ?? ''}`
                  : 'Report individuale'
              )
              setPdfLoading(false)
            }}
            disabled={pdfLoading}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {pdfLoading ? 'Generazione...' : '📄 Esporta PDF'}
          </button>
          <button
            onClick={() => exportPlayerCSV(playerName, history, targets)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            📊 Esporta CSV
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Nessuna sessione disponibile per questo giocatore.
        </div>
      ) : (
        <>
          {/* SEZIONE 1 — Ultima sessione vs Target */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Ultima sessione vs Target
            </h2>
            <div className="text-xs text-gray-400 mb-4">
              {formatDateShort(lastSession.session_date)} · {lastSession.session_type}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Giocatore"
                  dataKey="Giocatore"
                  fill="#3B82F6"
                  fillOpacity={0.5}
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
                <Radar
                  name="Target ottimo"
                  dataKey="Target ottimo"
                  fill="#8B1A2E"
                  fillOpacity={0.25}
                  stroke="#8B1A2E"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>

            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Parametro</th>
                  <th className="pb-2 font-medium text-right">Valore</th>
                  <th className="pb-2 font-medium text-right">Target ottimo</th>
                  <th className="pb-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {PARAMS.map(({ field, label, italianLabel }) => {
                  const val = lastSession[field]
                  const t = targetsMap[label]
                  return (
                    <tr key={field} className="border-b border-gray-50 last:border-0">
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

          {/* SEZIONE 2 — Andamento nel tempo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Andamento nel tempo
            </h2>
            {history.length < 2 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Servono almeno 2 sessioni per visualizzare il trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
                      dot={lineData.length > 20 ? false : { r: 3 }}
                      activeDot={{ r: 5 }}
                      hide={!!hiddenLines[label]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* SEZIONE 3 — vs Media squadra */}
          {sessionAverages && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                vs Media squadra (ultima sessione)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Giocatore" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Media squadra" fill="#8B1A2E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SEZIONE 4 — Commento automatico */}
          {comment && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 report-section">
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Commento automatico
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
