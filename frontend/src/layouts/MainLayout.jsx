import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SeasonGroupProvider, useSeasonGroup } from '../context/SeasonGroupContext'
import OfflineBanner from '../components/OfflineBanner'
import {
  LayoutDashboard, Users, User, ClipboardList, Calendar,
  Settings, Trophy, ChevronLeft, ChevronRight, MoreHorizontal, X,
} from 'lucide-react'

const primaryNavItems = [
  { to: '/',         label: 'Home',        icon: LayoutDashboard, end: true },
  { to: '/groups',   label: 'Rosa',        icon: Users },
  { to: '/sessions', label: 'Allenamenti', icon: ClipboardList },
  { to: '/partite',  label: 'Partite',     icon: Trophy },
]

const allNavItems = [
  ...primaryNavItems,
  { to: '/players', label: 'Giocatori', icon: User },
]

const staffNavItem    = { to: '/seasons',      label: 'Stagioni',     icon: Calendar }
const settingsNavItem = { to: '/impostazioni', label: 'Impostazioni', icon: Settings }

const roleLabel = (role) => ({
  admin:                'admin',
  responsabile_tecnico: 'resp. tecnico',
  allenatore:           'allenatore',
}[role] ?? role)

function NavItem({ to, label, icon: Icon, end, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-granata/10 text-granata'
            : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && label}
    </NavLink>
  )
}

function LayoutInner() {
  const { user, logout, isAdmin, isStaff } = useAuth()
  const { groups, selectedGroupId, setSelectedGroupId } = useSeasonGroup()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  const desktopNavItems = isStaff
    ? [...allNavItems, staffNavItem]
    : allNavItems

  const mobileDrawerItems = [
    { to: '/players', label: 'Giocatori', icon: User },
    ...(isStaff ? [staffNavItem] : []),
    settingsNavItem,
  ]

  const sidebarW = collapsed ? 'w-16' : 'w-60'
  const marginL  = collapsed ? 'md:ml-16' : 'md:ml-60'

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar desktop ── */}
      <aside className={`hidden md:flex flex-col ${sidebarW} bg-white border-r border-gray-200 fixed top-0 bottom-0 left-0 z-10 transition-[width] duration-200`}>

        {/* Logo */}
        <div className="bg-granata px-3 py-4 flex items-center gap-3 min-h-[68px] shrink-0">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain shrink-0" />
          {!collapsed && (
            <span className="text-white font-bold text-sm leading-tight">ASC.D Torino Club</span>
          )}
        </div>

        {/* Context bar — solo gruppo (stagione in impostazioni admin) */}
        <div className={`border-b border-gray-100 bg-gray-50 shrink-0 ${collapsed ? 'px-2 py-2' : 'px-3 py-2.5'}`}>
          {collapsed ? (
            <div
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-white border border-gray-200 text-gray-400"
              title={groups.find((g) => g.id === selectedGroupId)?.name ?? 'Tutti i gruppi'}
            >
              <Users size={16} strokeWidth={1.75} />
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Gruppo</p>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-granata"
              >
                <option value="">Tutti i gruppi</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <OfflineBanner />

        {/* Nav links */}
        <nav className="flex-1 p-2 flex flex-col overflow-y-auto min-h-0">
          <div className="space-y-0.5 flex-1">
            {desktopNavItems.map((item) => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </div>
          <div className="pt-2 border-t border-gray-100 space-y-0.5">
            <NavItem {...settingsNavItem} collapsed={collapsed} />
          </div>
        </nav>

        {/* User footer (solo espansa) */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-200 shrink-0">
            <p className="text-sm font-medium text-gray-700 truncate">
              {isAdmin ? (
                <span className="font-bold tracking-wide">ADMIN</span>
              ) : (
                <>
                  {user?.full_name || user?.email}
                  {user?.roles?.[0] && (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ({roleLabel(user.roles[0])})
                    </span>
                  )}
                </>
              )}
            </p>
            <button
              onClick={logout}
              className="mt-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Esci →
            </button>
          </div>
        )}

        {/* Pill di collapse — posizione assoluta sull'edge destra, sempre alla stessa Y */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center z-20 text-gray-400 hover:text-granata hover:border-granata transition-colors"
        >
          {collapsed
            ? <ChevronRight size={13} strokeWidth={2.5} />
            : <ChevronLeft  size={13} strokeWidth={2.5} />
          }
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className={`flex-1 ${marginL} pb-20 md:pb-0 transition-[margin] duration-200 min-w-0`}>

        {/* Mobile context bar — solo gruppo */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-10">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 focus:outline-none min-h-[40px]"
          >
            <option value="">Tutti i gruppi</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <main className="p-4 md:p-6 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav mobile (4 voci primarie + Altro) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {primaryNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-granata' : 'text-gray-500'
                }`
              }
            >
              <Icon size={22} strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              drawerOpen ? 'text-granata' : 'text-gray-500'
            }`}
          >
            <MoreHorizontal size={22} strokeWidth={1.75} />
            <span className="text-[10px] font-medium">Altro</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Altro</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 space-y-0.5">
              {mobileDrawerItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-granata/10 text-granata'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600 truncate">
                {user?.full_name || user?.email}
                {user?.roles?.[0] && (
                  <span className="text-xs text-gray-400 ml-1">({roleLabel(user.roles[0])})</span>
                )}
              </p>
              <button
                onClick={logout}
                className="text-xs text-red-500 hover:text-red-700 transition-colors ml-3 shrink-0 min-h-[44px] px-2"
              >
                Esci →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MainLayout() {
  return (
    <SeasonGroupProvider>
      <LayoutInner />
    </SeasonGroupProvider>
  )
}
