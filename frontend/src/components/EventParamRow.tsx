import type { MetricField, MetricType } from '../constants/domain'
import type { GroupTarget } from '../utils/reportUtils'
import {
  COGNITIVE_PARAMS,
  FIELD_TO_METRIC,
  METRIC_EVENT_CONFIG,
  RELIABILITY_META,
  deriveScore,
  deriveReliability,
} from '../constants/domain'
import { emptyEventRow } from '../types/eventRow'
import type { EventRow } from '../types/eventRow'

type CounterKey = 'numerator' | 'denominator'

function scoreBadgeClass(score: number | null, targetsMap: Record<string, GroupTarget>, field: MetricField): string {
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t || score == null) return 'bg-gray-100 text-gray-500'
  if (score <= t.insufficient_max) return 'bg-red-100 text-red-700'
  if (score >= t.ottimo_min)       return 'bg-green-100 text-green-700'
  return 'bg-yellow-100 text-yellow-700'
}

interface Props {
  field: MetricField
  playerId: string
  compact?: boolean
  eventData: Record<string, Record<string, EventRow>>
  targetsMap: Record<string, GroupTarget>
  onEventChange: (playerId: string, metricType: MetricType, key: CounterKey, delta: number) => void
  onEventSet: (playerId: string, metricType: MetricType, key: CounterKey, value: string) => void
}

export default function EventParamRow({ field, playerId, compact = false, eventData, targetsMap, onEventChange, onEventSet }: Props) {
  const metricType = FIELD_TO_METRIC[field]
  const cfg = METRIC_EVENT_CONFIG[field]
  const ev = eventData[playerId]?.[metricType] ?? emptyEventRow()
  const score = deriveScore(metricType, ev.numerator, ev.denominator)
  const rel = deriveReliability(metricType, ev.numerator, ev.denominator)
  const relMeta = RELIABILITY_META[rel]
  const badgeClass = scoreBadgeClass(score, targetsMap, field)
  const param = COGNITIVE_PARAMS.find((p) => p.field === field)!

  const CounterBtn = ({ counterKey, delta }: { counterKey: CounterKey; delta: number }) => (
    <button
      onClick={() => onEventChange(playerId, metricType, counterKey, delta)}
      className={`w-7 h-7 rounded-md font-bold text-sm flex items-center justify-center shrink-0 ${
        delta > 0
          ? 'bg-granata text-white active:opacity-80'
          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
      }`}
    >{delta > 0 ? '+' : '−'}</button>
  )

  const CounterInput = ({ counterKey }: { counterKey: CounterKey }) => (
    <input
      type="number"
      min="0"
      value={ev[counterKey]}
      onChange={(e) => onEventSet(playerId, metricType, counterKey, e.target.value)}
      className="w-11 text-center text-sm font-semibold border border-gray-300 rounded-md py-1 focus:outline-none focus:ring-2 focus:ring-granata"
    />
  )

  if (compact) {
    return (
      <div data-testid={`event-param-${param.label.toLowerCase()}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
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
        <div className="mt-1.5 text-[10px] text-gray-400 leading-tight">
          N: {cfg.numerator_label}
          {!cfg.count_only && <span>  ·  D: {cfg.denominator_label}</span>}
        </div>
      </div>
    )
  }

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
          <button onClick={() => onEventChange(playerId, metricType, 'numerator', -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-base flex items-center justify-center active:bg-gray-200">−</button>
          <input type="number" min="0" value={ev.numerator} onChange={(e) => onEventSet(playerId, metricType, 'numerator', e.target.value)} className="w-14 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-granata" />
          <button onClick={() => onEventChange(playerId, metricType, 'numerator', 1)} className="w-8 h-8 rounded-lg bg-granata text-white font-bold text-base flex items-center justify-center active:opacity-80">+</button>
        </div>
      </div>
      {!cfg.count_only && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-36 shrink-0">{cfg.denominator_label}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onEventChange(playerId, metricType, 'denominator', -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-base flex items-center justify-center active:bg-gray-200">−</button>
            <input type="number" min="0" value={ev.denominator} onChange={(e) => onEventSet(playerId, metricType, 'denominator', e.target.value)} className="w-14 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-granata" />
            <button onClick={() => onEventChange(playerId, metricType, 'denominator', 1)} className="w-8 h-8 rounded-lg bg-granata text-white font-bold text-base flex items-center justify-center active:opacity-80">+</button>
          </div>
        </div>
      )}
    </div>
  )
}
