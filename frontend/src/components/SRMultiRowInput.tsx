import { deriveSRReliability, deriveScore, RELIABILITY_META } from '../constants/domain'
import type { EventRow } from '../types/eventRow'
import type { GroupTarget } from '../utils/reportUtils'

interface Props {
  playerId: string
  rows: EventRow[]
  onAdd: () => void
  onUpdate: (index: number, key: 'numerator' | 'denominator', value: number) => void
  onDelete: (index: number) => void
  targetsMap: Record<string, GroupTarget>
}

export default function SRMultiRowInput({ rows, onAdd, onUpdate, onDelete, targetsMap }: Props) {
  const validRows = rows.filter((r) => r.denominator > 0)
  const n = validRows.length
  const reliability = n > 0 ? deriveSRReliability(n) : null
  const meta = reliability ? RELIABILITY_META[reliability] : null

  const sumNum = rows.reduce((s, r) => s + r.numerator, 0)
  const sumDen = rows.reduce((s, r) => s + r.denominator, 0)
  const score = sumDen > 0 ? deriveScore('SR', sumNum, sumDen) : null

  const t = targetsMap['SR']
  const scoreColor = score == null
    ? 'text-gray-400'
    : t && score <= t.insufficient_max
      ? 'text-red-600'
      : t && score >= t.ottimo_min
        ? 'text-green-600'
        : 'text-yellow-600'

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">SR</span>
          <span className="text-xs text-gray-400">Scanning Rate</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              {n} ric · {meta.label}
            </span>
          )}
          {score != null && (
            <span className={`text-sm font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
          )}
        </div>
      </div>

      {/* Column labels */}
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_28px] gap-2 mb-1 px-1">
          <span className="text-xs text-gray-400">Check pre-tocco</span>
          <span className="text-xs text-gray-400">Finestra (sec)</span>
          <span />
        </div>
      )}

      {/* Reception rows */}
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
            <input
              type="number"
              min={0}
              max={20}
              value={row.numerator}
              onChange={(e) => onUpdate(i, 'numerator', parseInt(e.target.value, 10) || 0)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-granata"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={row.denominator || ''}
              placeholder="sec"
              onChange={(e) => onUpdate(i, 'denominator', parseInt(e.target.value, 10) || 0)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-granata"
            />
            <button
              type="button"
              onClick={() => onDelete(i)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-base"
              aria-label="Rimuovi ricezione"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add row button */}
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 text-xs text-granata font-medium border border-granata/30 rounded-lg px-3 py-1.5 hover:bg-granata/5 transition-colors"
      >
        + Aggiungi ricezione
      </button>

      {rows.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">Aggiungi una riga per ogni ricezione osservata.</p>
      )}
    </div>
  )
}
