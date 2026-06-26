import { COGNITIVE_PARAMS, FIELD_TO_METRIC } from '../constants/domain'
import type { MetricField, MetricType } from '../constants/domain'
import type { MeasurementEntry, ApiPlayer } from '../hooks/useSessionForm'
import type { GroupTarget } from '../utils/reportUtils'
import type { EventRow } from '../types/eventRow'
import ToggleSwitch from './ToggleSwitch'
import EventParamRow from './EventParamRow'
import SRMultiRowInput from './SRMultiRowInput'
import { ReliabilityChip, ScoreCompletenessChip } from './SessionChips'

const PARAMS = COGNITIVE_PARAMS
type CounterKey = 'numerator' | 'denominator'

function valueBadgeClass(value: string | number | null, targetsMap: Record<string, GroupTarget>, field: MetricField): string {
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t || value === '' || value == null) return 'border-gray-300 bg-white'
  const v = parseFloat(String(value))
  if (v <= t.insufficient_max) return 'border-red-300 bg-red-50 text-red-800'
  if (v >= t.ottimo_min)       return 'border-green-300 bg-green-50 text-green-800'
  return 'border-yellow-300 bg-yellow-50 text-yellow-800'
}

interface Props {
  player: ApiPlayer
  measurement: MeasurementEntry
  entryMode: 'score' | 'event'
  targetsMap: Record<string, GroupTarget>
  eventData: Record<string, Record<string, EventRow>>
  srRows: EventRow[]
  reliabilityOk: number
  hasEventData: boolean
  scoreFilled: number
  onToggleAbsent: () => void
  onChange: (field: MetricField | 'notes', value: number | string | null) => void
  onEventChange: (playerId: string, metricType: MetricType, key: CounterKey, delta: number) => void
  onEventSet: (playerId: string, metricType: MetricType, key: CounterKey, value: string) => void
  onAddSR: () => void
  onUpdateSR: (i: number, key: CounterKey, value: number) => void
  onDeleteSR: (i: number) => void
}

export default function DesktopPlayerCard({
  player: p,
  measurement: m,
  entryMode,
  targetsMap,
  eventData,
  srRows,
  reliabilityOk,
  hasEventData,
  scoreFilled,
  onToggleAbsent,
  onChange,
  onEventChange,
  onEventSet,
  onAddSR,
  onUpdateSR,
  onDeleteSR,
}: Props) {
  return (
    <div className={`bg-white rounded-xl border p-4 transition-opacity ${m.is_absent ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-gray-900">{p.last_name} {p.first_name}</span>
        <div className="flex items-center gap-2 select-none">
          {entryMode === 'event' && !m.is_absent && hasEventData && (
            <ReliabilityChip ok={reliabilityOk} total={PARAMS.length} />
          )}
          {entryMode === 'score' && !m.is_absent && (
            <ScoreCompletenessChip filled={scoreFilled} total={PARAMS.length} />
          )}
          <span className="text-sm text-gray-500">Assente</span>
          <ToggleSwitch checked={m.is_absent} onChange={onToggleAbsent} size="sm" />
        </div>
      </div>

      {!m.is_absent && entryMode === 'score' && (
        <div className="grid grid-cols-5 gap-2">
          {PARAMS.map(({ label, field }) => (
            <div key={field} className="text-center">
              <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
              <input
                type="number"
                min="1" max="10" step="1"
                value={m[field] !== '' && m[field] != null ? Math.round(Number(m[field])) : ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') { onChange(field, null); return }
                  const num = parseInt(raw, 10)
                  if (!isNaN(num) && num >= 1 && num <= 10) onChange(field, num)
                }}
                onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
                disabled={m.is_absent}
                className={`w-full text-center border rounded-lg text-sm font-semibold min-h-12 focus:outline-none focus:ring-2 focus:ring-granata disabled:cursor-not-allowed transition-colors ${
                  m.is_absent ? 'bg-gray-50 border-gray-200 text-gray-300' : valueBadgeClass(m[field], targetsMap, field)
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {!m.is_absent && entryMode === 'event' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {PARAMS.map(({ field }) =>
            field === 'scanning_rate' ? (
              <div key="sr" className="lg:col-span-2">
                <SRMultiRowInput
                  playerId={p.id}
                  rows={srRows}
                  onAdd={onAddSR}
                  onUpdate={onUpdateSR}
                  onDelete={onDeleteSR}
                  targetsMap={targetsMap}
                />
              </div>
            ) : (
              <EventParamRow
                key={field}
                field={field}
                playerId={p.id}
                compact
                eventData={eventData}
                targetsMap={targetsMap}
                onEventChange={onEventChange}
                onEventSet={onEventSet}
              />
            )
          )}
        </div>
      )}

      {!m.is_absent && (
        <div className="mt-3">
          <textarea
            value={m.notes ?? ''}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Note giocatore…"
            rows={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-granata resize-none"
          />
        </div>
      )}
    </div>
  )
}
