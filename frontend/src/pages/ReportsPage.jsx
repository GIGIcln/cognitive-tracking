import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlayers } from '../api/players'
import { getGroups } from '../api/groups'

export default function ReportsPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPlayers(), getGroups()])
      .then(([pr, gr]) => {
        const sorted = [...pr.data].sort(
          (a, b) =>
            a.last_name.localeCompare(b.last_name, 'it') ||
            a.first_name.localeCompare(b.first_name, 'it')
        )
        setPlayers(sorted)
        setGroups(gr.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Report</h1>

      {/* Report Giocatore */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Report Giocatore</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
          >
            <option value="">Seleziona giocatore…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.last_name} {p.first_name}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedPlayer}
            onClick={() => navigate(`/reports/player/${selectedPlayer}`)}
            className="px-4 py-2 bg-granata text-white rounded-lg text-sm font-medium hover:bg-granata-dark transition-colors disabled:opacity-40"
          >
            Visualizza report
          </button>
        </div>
      </div>

      {/* Report Squadra */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Report Squadra</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
          >
            <option value="">Seleziona gruppo…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedGroup}
            onClick={() => navigate(`/reports/group/${selectedGroup}`)}
            className="px-4 py-2 bg-granata text-white rounded-lg text-sm font-medium hover:bg-granata-dark transition-colors disabled:opacity-40"
          >
            Visualizza report
          </button>
        </div>
      </div>
    </div>
  )
}
