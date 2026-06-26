export function ReliabilityChip({ ok, total }: { ok: number; total: number }) {
  let cls
  if (ok >= total)                     cls = 'bg-green-100 text-green-700'
  else if (ok >= Math.ceil(total / 2)) cls = 'bg-yellow-100 text-yellow-700'
  else                                 cls = 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {ok}/{total}
    </span>
  )
}

export function ScoreCompletenessChip({ filled, total }: { filled: number; total: number }) {
  let cls
  if (filled === total && total > 0) cls = 'bg-green-100 text-green-700'
  else if (filled === 0)             cls = 'bg-red-100 text-red-700'
  else                               cls = 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {filled}/{total}
    </span>
  )
}
