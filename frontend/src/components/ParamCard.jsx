function cellClass(val, target) {
  if (val == null || !target) return ''
  if (val >= target.ottimo_min) return 'bg-green-50 text-green-800'
  if (val <= target.insufficient_max) return 'bg-red-50 text-red-800'
  return 'bg-yellow-50 text-yellow-800'
}

export default function ParamCard({ field, italianLabel, target, measurements }) {
  const withValue = [...measurements]
    .filter((m) => m[field] != null)
    .sort((a, b) => b[field] - a[field])
  const withoutValue = measurements.filter((m) => m[field] == null)
  const allSorted = [...withValue, ...withoutValue]

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-600 text-center border-b border-gray-100 pb-2 mb-2">
        {italianLabel}
      </div>
      <div className="max-h-[220px] overflow-y-auto space-y-1">
        {allSorted.map((m, i) => {
          const val = m[field]
          const hasValue = val != null
          return (
            <div key={m.player_id} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs w-4 text-right shrink-0">
                  {hasValue ? i + 1 : ''}
                </span>
                <span className="text-xs text-gray-700">{m.last_name}</span>
              </div>
              <span className={`text-xs font-semibold shrink-0 ${hasValue ? cellClass(val, target) : 'text-gray-300'}`}>
                {hasValue ? val.toFixed(1) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
