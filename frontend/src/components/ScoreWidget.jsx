export default function ScoreWidget({ code, label, value, target, delta }) {
  let pct = 0
  let statusColor = '#9CA3AF'
  let statusLabel = '—'

  if (value != null) {
    pct = Math.min(100, (value / 10) * 100)
    if (target) {
      if (value >= target.ottimo_min) {
        statusColor = '#059669'
        statusLabel = 'Ottimo'
      } else if (value <= target.insufficient_max) {
        statusColor = '#DC2626'
        statusLabel = 'Insuff.'
      } else {
        statusColor = '#D97706'
        statusLabel = 'Suff.'
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 flex flex-col items-center text-center gap-0.5 min-w-0">
      <div className="text-[9px] sm:text-[10px] font-black text-gray-400 tracking-widest uppercase">
        {code}
      </div>
      <div className="text-lg sm:text-2xl font-black text-gray-900 leading-none tabular-nums">
        {value != null ? value.toFixed(1) : '—'}
      </div>
      <div className="hidden sm:block text-[9px] text-gray-400 break-words w-full leading-tight">
        {label}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: statusColor }}
        />
      </div>
      <div className="text-[9px] sm:text-[10px] font-bold leading-none" style={{ color: statusColor }}>
        {statusLabel}
      </div>
      {delta != null && (
        <div
          className={`text-[8px] font-semibold ${
            delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
        </div>
      )}
    </div>
  )
}
