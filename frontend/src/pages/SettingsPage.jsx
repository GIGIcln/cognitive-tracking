import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { isAdmin } = useAuth()

  const tabs = [
    ...(isAdmin ? [{ to: '/impostazioni/utenti', label: 'Utenti' }] : []),
    { to: '/impostazioni/profilo', label: 'Profilo' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Impostazioni</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-granata text-granata'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
