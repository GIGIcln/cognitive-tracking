import { Outlet, NavLink } from 'react-router-dom'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-granata text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-wide">
            Cognitive Tracking
          </span>
          <nav className="flex gap-6 text-sm font-medium">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'text-oro' : 'text-white hover:text-oro transition-colors'
              }
            >
              Dashboard
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-granata-950 text-gray-400 text-xs text-center py-3">
        © {new Date().getFullYear()} Cognitive Tracking
      </footer>
    </div>
  )
}
