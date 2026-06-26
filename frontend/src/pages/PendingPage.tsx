import { useAuth } from '../context/AuthContext'
import { Clock } from 'lucide-react'

export default function PendingPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-yellow-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account in attesa</h1>
        <p className="text-gray-500 text-sm mb-1">
          Ciao{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Il tuo account è stato creato ma non è ancora stato attivato.
          L'amministratore ti assegnerà un gruppo e attiverà l'accesso a breve.
        </p>
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Esci
        </button>
      </div>
    </div>
  )
}
