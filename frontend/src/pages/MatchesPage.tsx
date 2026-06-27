import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMatches, getScorers } from '../api/matches'
import MatchFormModal from '../components/MatchFormModal'
import { useAuth } from '../context/AuthContext'
import type { Match, Scorer } from '../types/api'

const HOME_AWAY_LABEL: Record<string, string> = { home: 'Casa', away: 'Trasferta', neutral: 'Neutro' }
const MATCH_TYPE_LABEL: Record<string, string> = { campionato: 'Campionato', coppa: 'Coppa', amichevole: 'Amichevole' }

function resultChip(m: Match) {
  if (m.score_home == null || m.score_away == null) return null
  const diff = m.score_home - m.score_away
  if (diff > 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">V</span>
  if (diff < 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">S</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">P</span>
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MatchesPage() {
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [scorers, setScorers] = useState<Scorer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAllScorers, setShowAllScorers] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([listMatches(), getScorers()])
      .then(([matchRes, scorersRes]) => {
        setMatches(matchRes.data)
        setScorers(scorersRes.data as Scorer[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const played = matches.filter((m) => m.score_home != null && m.score_away != null)
  const scheduled = matches.filter((m) => m.score_home == null || m.score_away == null)

  const wins = played.filter((m) => (m.score_home ?? 0) > (m.score_away ?? 0)).length
  const draws = played.filter((m) => m.score_home === m.score_away).length
  const losses = played.length - wins - draws
  const goalsFor = played.reduce((s, m) => s + (m.score_home ?? 0), 0)
  const goalsAgainst = played.reduce((s, m) => s + (m.score_away ?? 0), 0)
  const cleanSheets = played.filter((m) => (m.score_away ?? 0) === 0).length

  const MatchCard = ({ m }: { m: Match }) => (
    <div
      key={m.id}
      onClick={() => navigate(`/partite/${m.id}`)}
      className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:border-granata/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-900">{m.opponent}</span>
        <div className="flex items-center gap-2">
          {m.score_home != null && m.score_away != null && (
            <span className="text-sm font-bold text-gray-900">
              {m.score_home} – {m.score_away}
            </span>
          )}
          {resultChip(m)}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{fmtDate(m.match_date)}</span>
        <span>·</span>
        <span>{HOME_AWAY_LABEL[m.home_away] ?? m.home_away}</span>
        <span>·</span>
        <span>{MATCH_TYPE_LABEL[m.match_type] ?? m.match_type}</span>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partite</h1>
        {!isStaff && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-granata text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-granata-dark transition-colors"
          >
            + Nuova partita
          </button>
        )}
      </div>

      {/* Record stagionale */}
      {!loading && played.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-green-700 text-lg">{wins}V</span>
              <span className="text-gray-300">·</span>
              <span className="font-bold text-yellow-600 text-lg">{draws}P</span>
              <span className="text-gray-300">·</span>
              <span className="font-bold text-red-600 text-lg">{losses}S</span>
            </div>
            <div className="h-4 w-px bg-gray-200 hidden sm:block" />
            <div className="text-sm text-gray-600">
              Gol <span className="font-semibold text-gray-900">{goalsFor}</span>
              <span className="text-gray-400 mx-1">/</span>
              <span className="font-semibold text-gray-900">{goalsAgainst}</span>
            </div>
            {cleanSheets > 0 && (
              <>
                <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                <div className="text-sm text-gray-600">
                  Clean sheet <span className="font-semibold text-gray-900">{cleanSheets}</span>
                </div>
              </>
            )}
            <div className="ml-auto text-xs text-gray-400">{played.length} partite giocate</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Programmate</div>
              <div className="space-y-2">
                {scheduled.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {played.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Giocate</div>
              <div className="space-y-2">
                {played.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {scorers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Marcatori</div>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {(showAllScorers ? scorers : scorers.slice(0, 5)).map((s, i) => (
                  <div key={s.player_id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-900">{s.last_name} {s.first_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 shrink-0">
                      <span>⚽ <strong>{s.goals}</strong></span>
                      {s.assists > 0 && <span>🅰 {s.assists}</span>}
                      <span className="text-gray-400">{s.matches_played}p</span>
                    </div>
                  </div>
                ))}
              </div>
              {scorers.length > 5 && (
                <button
                  onClick={() => setShowAllScorers((v) => !v)}
                  className="mt-2 text-xs text-granata hover:text-granata-dark font-medium"
                >
                  {showAllScorers ? 'Mostra meno' : `Tutti i marcatori (${scorers.length})`}
                </button>
              )}
            </div>
          )}

          {!matches.length && (
            <div className="text-center text-gray-400 py-12 text-sm">
              Nessuna partita registrata
            </div>
          )}
        </div>
      )}

      {showModal && (
        <MatchFormModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
