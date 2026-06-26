import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const justRegistered = searchParams.get('registered') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (error) {
      const msg = error.response?.data?.detail
        || error.message
        || 'Errore sconosciuto'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-granata flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900">ASC.D Torino Club</h1>
          <p className="text-sm text-gray-500 mt-1">ASC.D Torino Club Gallarate</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {justRegistered && (
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-200">
              Registrazione completata. Accedi e attendi che l'amministratore attivi il tuo account.
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-granata"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-granata hover:bg-granata-dark text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Sei un allenatore?{' '}
          <Link to="/register" className="text-granata font-medium hover:underline">
            Crea account
          </Link>
        </p>
      </div>
    </div>
  )
}
