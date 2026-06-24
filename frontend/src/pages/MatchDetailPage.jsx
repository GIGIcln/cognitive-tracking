import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMatch, saveLineup, deleteMatch } from '../api/matches'
import { getPlayers } from '../api/players'
import MatchFormModal from '../components/MatchFormModal'
import { useAuth } from '../context/AuthContext'
import { POSITIONS } from '../constants/domain'

const HOME_AWAY_LABEL = { home: 'Casa', away: 'Trasferta', neutral: 'Neutro' }
const MATCH_TYPE_LABEL = { campionato: 'Campionato', coppa: 'Coppa', amichevole: 'Amichevole' }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function ResultBadge({ scoreHome, scoreAway }) {
  if (scoreHome == null || scoreAway == null) return <span className="text-sm text-gray-400">Non ancora giocata</span>
  const diff = scoreHome - scoreAway
  const cls = diff > 0 ? 'bg-green-100 text-green-800' : diff < 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
  const label = diff > 0 ? 'Vittoria' : diff < 0 ? 'Sconfitta' : 'Pareggio'
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold text-gray-900">{scoreHome} – {scoreAway}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
    </div>
  )
}

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // lineup state
  const [players, setPlayers] = useState([])
  const [lineup, setLineup] = useState({})
  const [savingLineup, setSavingLineup] = useState(false)
  const [lineupOk, setLineupOk] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getMatch(id)
      .then((res) => {
        const m = res.data
        setMatch(m)
        const initial = {}
        for (const lu of m.lineups) {
          initial[lu.player_id] = {
            played: true,
            minutes_played: lu.minutes_played ?? '',
            position: lu.position ?? '',
            notes: lu.notes ?? '',
          }
        }
        setLineup(initial)
        return getPlayers(m.group_id)
      })
      .then((res) => setPlayers(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const togglePlayed = (playerId) => {
    setLineup((prev) => {
      const cur = prev[playerId]
      if (cur?.played) {
        const next = { ...prev }
        delete next[playerId]
        return next
      }
      return { ...prev, [playerId]: { played: true, minutes_played: '', position: '', notes: '' } }
    })
    setLineupOk(false)
  }

  const setLineupField = (playerId, field, value) => {
    setLineup((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
    setLineupOk(false)
  }

  const handleSaveLineup = async () => {
    setSavingLineup(true)
    try {
      const lineups = Object.entries(lineup)
        .filter(([, v]) => v.played)
        .map(([player_id, v]) => ({
          player_id,
          minutes_played: v.minutes_played !== '' ? parseInt(v.minutes_played) : null,
          position: v.position || null,
          notes: v.notes || null,
        }))
      await saveLineup(id, lineups)
      setLineupOk(true)
      setTimeout(() => setLineupOk(false), 2500)
    } catch {
      /* noop */
    } finally {
      setSavingLineup(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMatch(id)
      navigate('/partite')
    } catch {
      /* noop */
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!match) {
    return <div className="text-red-600 text-sm">Partita non trovata</div>
  }

  const playedCount = Object.values(lineup).filter((v) => v.played).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/partite')} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{match.opponent}</h1>
          <div className="text-sm text-gray-500">{fmtDate(match.match_date)}</div>
        </div>
        {!isStaff && (
          <button onClick={() => setShowEdit(true)} className="text-xs font-medium text-granata border border-granata/30 rounded-lg px-3 py-1.5 hover:bg-granata/5">
            Modifica
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {[
          { key: 'info', label: 'Risultato' },
          { key: 'lineup', label: `Formazione${playedCount ? ` (${playedCount})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-granata text-granata' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 text-center">
            <ResultBadge scoreHome={match.score_home} scoreAway={match.score_away} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              { label: 'Tipo gara', value: MATCH_TYPE_LABEL[match.match_type] ?? match.match_type },
              { label: 'Campo', value: HOME_AWAY_LABEL[match.home_away] ?? match.home_away },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {match.notes && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Note</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{match.notes}</div>
            </div>
          )}

          {isAdmin && (
            <div className="pt-2">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 underline">
                  Elimina partita
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="flex-1 bg-red-600 text-white text-sm py-2 rounded-xl">Conferma eliminazione</button>
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-gray-300 text-sm py-2 rounded-xl text-gray-600">Annulla</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lineup tab */}
      {activeTab === 'lineup' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {players.map((p) => {
              const entry = lineup[p.id]
              const isIn = !!entry?.played
              return (
                <div key={p.id} className={`px-4 py-3 transition-colors ${isIn ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{p.last_name} {p.first_name}</span>
                      {p.position && <span className="text-xs text-gray-400 ml-2">{p.position}</span>}
                    </div>
                    <button
                      onClick={() => !isStaff && togglePlayed(p.id)}
                      disabled={isStaff}
                      className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
                        isIn
                          ? 'bg-granata text-white border-granata'
                          : 'bg-white text-gray-500 border-gray-300 hover:border-granata/40'
                      }`}
                    >
                      {isIn ? 'In campo' : 'Non schierato'}
                    </button>
                  </div>

                  {isIn && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input
                        type="number" min="0" max="120"
                        placeholder="Minuti"
                        value={entry.minutes_played}
                        onChange={(e) => !isStaff && setLineupField(p.id, 'minutes_played', e.target.value)}
                        disabled={isStaff}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-granata"
                      />
                      <select
                        value={entry.position}
                        onChange={(e) => !isStaff && setLineupField(p.id, 'position', e.target.value)}
                        disabled={isStaff}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-granata"
                      >
                        <option value="">Posizione</option>
                        {POSITIONS.map((pos) => <option key={pos.value} value={pos.value}>{pos.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!players.length && (
            <div className="text-center text-gray-400 text-sm py-8">Nessun giocatore nel gruppo</div>
          )}

          {!isStaff && (
            <button
              onClick={handleSaveLineup}
              disabled={savingLineup || !players.length}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                lineupOk ? 'bg-green-600 text-white' : 'bg-granata text-white disabled:opacity-50'
              }`}
            >
              {savingLineup ? 'Salvataggio…' : lineupOk ? 'Formazione salvata ✓' : 'Salva formazione'}
            </button>
          )}
        </div>
      )}

      {showEdit && (
        <MatchFormModal
          match={match}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}
