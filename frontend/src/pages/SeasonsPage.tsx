import React, { useState, useEffect } from 'react'
import { getSeasons, createSeason, getSeasonStats } from '../api/seasons'
import type { Season, SeasonStats } from '../types/api'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<SeasonStats | null>(null)

  const current = seasons.find((s) => s.is_current) ?? null
  const archived = seasons.filter((s) => !s.is_current)

  useEffect(() => {
    getSeasons()
      .then((res) => {
        const data = res.data as Season[]
        setSeasons(data)
        const cur = data.find((s) => s.is_current)
        if (cur) {
          getSeasonStats(cur.id)
            .then((r) => setStats(r.data))
            .catch(() => {})
        }
      })
      .catch(() => setError('Errore nel caricamento delle stagioni'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await createSeason({
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
      setSeasons((prev) =>
        [res.data, ...prev.map((s) => ({ ...s, is_current: false }))]
      )
      setShowForm(false)
      setForm({ name: '', start_date: '', end_date: '' })
    } catch {
      setError('Errore durante la creazione della stagione')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Gestione Stagioni</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-granata text-white rounded-lg text-sm font-medium hover:bg-granata/90 transition-colors"
          >
            + Nuova stagione
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Form nuova stagione */}
      {showForm && (
        <div className="bg-white rounded-xl border border-granata/30 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Nuova stagione
            {current && (
              <span className="ml-2 text-xs font-normal text-amber-600">
                — archivierà automaticamente «{current.name}»
              </span>
            )}
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nome stagione <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="es. 2027-2028"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Data inizio
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Data fine
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-granata text-white rounded-lg text-sm font-medium hover:bg-granata/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvataggio…' : 'Crea stagione'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stagione corrente */}
      {current ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-800">Stagione corrente</h2>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
              Attiva
            </span>
          </div>
          <div className="text-2xl font-bold text-granata mb-1">{current.name}</div>
          <div className="text-xs text-gray-500">
            {formatDate(current.start_date)} — {formatDate(current.end_date)}
          </div>

          {stats && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  ['Sessioni', stats.total_sessions],
                  ['Giocatori', stats.total_players],
                  ['Gruppi', stats.total_groups],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold text-granata">{value ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {stats.total_sessions > 0 && (
                <div className="grid grid-cols-5 gap-2 text-center">
                  {([
                    ['SR',  stats.avg_sr],
                    ['DQI', stats.avg_dqi],
                    ['AI',  stats.avg_ai],
                    ['TRS', stats.avg_trs],
                    ['VCI', stats.avg_vci],
                  ] as [string, number | null][]).map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg py-2">
                      <div className="text-sm font-bold text-gray-800">
                        {val != null ? val.toFixed(1) : '—'}
                      </div>
                      <div className="text-[10px] text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Nessuna stagione corrente. Crea una nuova stagione per iniziare.
        </div>
      )}

      {/* Stagioni archiviate */}
      {archived.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Stagioni archiviate</h2>
          <div className="divide-y divide-gray-100">
            {archived.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatDate(s.start_date)} — {formatDate(s.end_date)}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                  Archiviata
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
