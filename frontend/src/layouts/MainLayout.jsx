import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import OfflineBanner from '../components/OfflineBanner'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/groups', label: 'Gruppi', icon: '👥' },
  { to: '/players', label: 'Giocatori', icon: '⚽' },
  { to: '/sessions', label: 'Sessioni', icon: '📋' },
  { to: '/reports', label: 'Report', icon: '📊' },
]

export default function MainLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 fixed top-0 bottom-0 left-0 z-10">
        <div className="bg-granata px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oro flex items-center justify-center text-granata font-bold text-lg shrink-0">
              CT
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Cognitive Tracking</div>
              <div className="text-white/70 text-xs mt-0.5">ASC.D Torino Club</div>
            </div>
          </div>
        </div>

        <OfflineBanner />
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-granata/10 text-granata border-l-4 border-granata pl-2'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2 truncate">
            {user?.full_name || user?.email}
          </div>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            Esci →
          </button>
        </div>
      </aside>

      {/* Content area — pb-20 on mobile leaves room for the 64px bottom nav + safe area */}
      <div className="flex-1 md:ml-60 pb-20 md:pb-0">
        <main className="p-4 md:p-6 max-w-4xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile — 64px tall + safe area padding */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[48px] ${
                  isActive ? 'text-granata' : 'text-gray-500'
                }`
              }
            >
              <span className="text-2xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
