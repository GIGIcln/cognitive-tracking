import React, { useState, useEffect } from 'react'
import { createMatch, updateMatch } from '../api/matches'
import { getGroups } from '../api/groups'
import { getSeasons } from '../api/seasons'
import { useAuth } from '../context/AuthContext'

const HOME_AWAY_OPTIONS = [
  { value: 'home', label: 'Casa' },
  { value: 'away', label: 'Trasferta' },
  { value: 'neutral', label: 'Campo neutro' },
]

const MATCH_TYPE_OPTIONS = [
  { value: 'campionato', label: 'Campionato' },
  { value: 'coppa', label: 'Coppa' },
  { value: 'amichevole', label: 'Amichevole' },
]

interface MatchData {
  id: string
  group_id?: string
  season_id?: string
  match_date?: string
  opponent?: string
  home_away?: string
  match_type?: string
  score_home?: number | string | null
  score_away?: number | string | null
  notes?: string | null
}

interface GroupOption {
  id: string
  name: string
}

interface SeasonOption {
  id: string
  name: string
}

interface MatchFormModalProps {
  match?: MatchData | null
  preselectedGroupId?: string | null
  onClose: () => void
  onSaved: () => void
}

interface MatchForm {
  group_id: string
  season_id: string
  match_date: string
  opponent: string
  home_away: string
  match_type: string
  score_home: string
  score_away: string
  notes: string
}

const EMPTY: MatchForm = {
  group_id: '', season_id: '', match_date: '', opponent: '',
  home_away: 'home', match_type: 'campionato',
  score_home: '', score_away: '', notes: '',
}

export default function MatchFormModal({ match, preselectedGroupId, onClose, onSaved }: MatchFormModalProps) {
  const { isAdmin } = useAuth()
  const isEdit = !!match

  const [form, setForm] = useState<MatchForm>(EMPTY)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [seasons, setSeasons] = useState<SeasonOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getGroups(), getSeasons()]).then(([g, s]) => {
      setGroups(g.data)
      setSeasons(s.data)
    })
  }, [])

  useEffect(() => {
    if (isEdit) {
      setForm({
        group_id: match.group_id ?? '',
        season_id: match.season_id ?? '',
        match_date: match.match_date ?? '',
        opponent: match.opponent ?? '',
        home_away: match.home_away ?? 'home',
        match_type: match.match_type ?? 'campionato',
        score_home: match.score_home != null ? String(match.score_home) : '',
        score_away: match.score_away != null ? String(match.score_away) : '',
        notes: match.notes ?? '',
      })
    } else {
      setForm({ ...EMPTY, group_id: preselectedGroupId ?? '' })
    }
  }, [match, preselectedGroupId, isEdit])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!form.group_id || !form.season_id || !form.match_date || !form.opponent) {
      setError('Gruppo, stagione, data e avversario sono obbligatori')
      return
    }
    setSaving(true)
    try {
      const payload = {
        group_id: form.group_id,
        season_id: form.season_id,
        match_date: form.match_date,
        opponent: form.opponent,
        home_away: form.home_away,
        match_type: form.match_type,
        score_home: form.score_home !== '' ? parseInt(form.score_home) : null,
        score_away: form.score_away !== '' ? parseInt(form.score_away) : null,
        notes: form.notes || null,
      }
      if (isEdit) {
        await updateMatch(match!.id, payload)
      } else {
        await createMatch(payload)
      }
      onSaved()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } }
      setError(apiErr.response?.data?.detail ?? 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata w-full'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Modifica partita' : 'Nuova partita'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>
          )}

          <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} className={inputCls} disabled={!isAdmin && !!preselectedGroupId}>
            <option value="">Gruppo *</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select value={form.season_id} onChange={(e) => setForm({ ...form, season_id: e.target.value })} className={inputCls}>
            <option value="">Stagione *</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <input type="date" value={form.match_date} onChange={(e) => setForm({ ...form, match_date: e.target.value })} className={inputCls} required />

          <input placeholder="Avversario *" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} className={inputCls} required />

          <div className="grid grid-cols-2 gap-2">
            <select value={form.home_away} onChange={(e) => setForm({ ...form, home_away: e.target.value })} className={inputCls}>
              {HOME_AWAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })} className={inputCls}>
              {MATCH_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" max="99" placeholder="Gol noi" value={form.score_home} onChange={(e) => setForm({ ...form, score_home: e.target.value })} className={inputCls} />
            <input type="number" min="0" max="99" placeholder="Gol avversario" value={form.score_away} onChange={(e) => setForm({ ...form, score_away: e.target.value })} className={inputCls} />
          </div>

          <textarea placeholder="Note (opzionale)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls + ' resize-none'} />

          <button type="submit" disabled={saving} className="w-full bg-granata text-white py-3 rounded-xl font-medium text-sm disabled:opacity-60">
            {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea partita'}
          </button>
        </form>
      </div>
    </div>
  )
}
