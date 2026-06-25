import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import PlayersPage from './pages/PlayersPage'
import SessionsPage from './pages/SessionsPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'

const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const PlayerDetailPage = lazy(() => import('./pages/PlayerDetailPage'))
const PlayerReportPage = lazy(() => import('./pages/PlayerReportPage'))
const TeamReportPage = lazy(() => import('./pages/TeamReportPage'))
const SessionTeamReportPage = lazy(() => import('./pages/SessionTeamReportPage'))
const SessionPlayerReportPage = lazy(() => import('./pages/SessionPlayerReportPage'))
const SeasonsPage = lazy(() => import('./pages/SeasonsPage'))
const UsersAdminPage = lazy(() => import('./pages/UsersAdminPage'))
const SeasonSettingsPage = lazy(() => import('./pages/SeasonSettingsPage'))
const MatchesPage = lazy(() => import('./pages/MatchesPage'))
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route
              path="/players/:id"
              element={<Suspense fallback={<PageLoader />}><PlayerDetailPage /></Suspense>}
            />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route
              path="/sessions/:id"
              element={<Suspense fallback={<PageLoader />}><SessionDetailPage /></Suspense>}
            />
            <Route
              path="/reports"
              element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>}
            />
            <Route
              path="/reports/player/:playerId"
              element={<Suspense fallback={<PageLoader />}><PlayerReportPage /></Suspense>}
            />
            <Route
              path="/reports/group/:groupId"
              element={<Suspense fallback={<PageLoader />}><TeamReportPage /></Suspense>}
            />
            <Route
              path="/reports/session/:sessionId"
              element={<Suspense fallback={<PageLoader />}><SessionTeamReportPage /></Suspense>}
            />
            <Route
              path="/reports/session/:sessionId/player/:playerId"
              element={<Suspense fallback={<PageLoader />}><SessionPlayerReportPage /></Suspense>}
            />
            <Route
              path="/seasons"
              element={<Suspense fallback={<PageLoader />}><SeasonsPage /></Suspense>}
            />
            <Route
              path="/partite"
              element={<Suspense fallback={<PageLoader />}><MatchesPage /></Suspense>}
            />
            <Route
              path="/partite/:id"
              element={<Suspense fallback={<PageLoader />}><MatchDetailPage /></Suspense>}
            />
            <Route path="/impostazioni" element={<SettingsPage />}>
              <Route index element={<Navigate to="/impostazioni/profilo" replace />} />
              <Route path="profilo" element={<ProfilePage />} />
              <Route
                path="utenti"
                element={<Suspense fallback={<PageLoader />}><UsersAdminPage /></Suspense>}
              />
              <Route
                path="stagione"
                element={<Suspense fallback={<PageLoader />}><SeasonSettingsPage /></Suspense>}
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
