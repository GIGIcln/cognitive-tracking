import type { GroupTarget } from '../utils/reportUtils'
import type { Measurement } from '../types/api'

interface ParamCardProps {
  field: string
  italianLabel: string
  target: GroupTarget | undefined
  measurements: Measurement[]
}

function cellClass(val: number, target: GroupTarget | undefined): string {
  if (val == null || !target) return ''
  if (val >= target.ottimo_min) return 'bg-green-50 text-green-800'
  if (val <= target.insufficient_max) return 'bg-red-50 text-red-800'
  return 'bg-yellow-50 text-yellow-800'
}

export default function ParamCard({ field, italianLabel, target, measurements }: ParamCardProps) {
  const asMap = (m: Measurement) => m as unknown as Record<string, number | null>
  const withValue = [...measurements]
    .filter((m) => asMap(m)[field] != null)
    .sort((a, b) => (asMap(b)[field] ?? 0) - (asMap(a)[field] ?? 0))
  const withoutValue = measurements.filter((m) => asMap(m)[field] == null)
  const allSorted = [...withValue, ...withoutValue]

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-600 text-center border-b border-gray-100 pb-2 mb-2">
        {italianLabel}
      </div>
      <div className="max-h-[220px] overflow-y-auto space-y-1">
        {allSorted.map((m, i) => {
          const val = asMap(m)[field] as number | null | undefined
          const hasValue = val != null
          return (
            <div key={m.player_id} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs w-4 text-right shrink-0">
                  {hasValue ? i + 1 : ''}
                </span>
                <span className="text-xs text-gray-700">{m.last_name}</span>
              </div>
              <span className={`text-xs font-semibold shrink-0 ${hasValue ? cellClass(val!, target) : 'text-gray-300'}`}>
                {hasValue ? val!.toFixed(1) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
