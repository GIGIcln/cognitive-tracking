import { useSeasonGroup } from '../context/SeasonGroupContext'

export default function SeasonSettingsPage() {
  const { seasons, selectedSeasonId, setSelectedSeasonId } = useSeasonGroup()

  const selected = seasons.find((s) => s.id === selectedSeasonId)

  const formatRange = (s) => {
    if (!s?.start_date || !s?.end_date) return s?.name ?? '—'
    const y1 = new Date(s.start_date).getFullYear()
    const y2 = new Date(s.end_date).getFullYear()
    return y1 === y2 ? String(y1) : `${y1}/${String(y2).slice(2)}`
  }

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Stagione attiva</h2>
      <p className="text-sm text-gray-500 mb-5">
        La stagione selezionata filtra automaticamente i dati in tutta l'applicazione.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-4 py-3">
          <label className="block text-xs text-gray-400 mb-1">Stagione corrente</label>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-granata min-h-[44px]"
          >
            {seasons.length === 0 && <option value="">Nessuna stagione disponibile</option>}
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="px-4 py-3">
            <div className="text-xs text-gray-400 mb-0.5">Periodo</div>
            <div className="text-sm font-medium text-gray-900">{formatRange(selected)}</div>
          </div>
        )}
      </div>

      {seasons.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">
          Nessuna stagione trovata. Creane una dalla sezione{' '}
          <a href="/seasons" className="text-granata hover:underline">Stagioni</a>.
        </p>
      )}
    </div>
  )
}
