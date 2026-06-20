import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import PlayersPage from './pages/PlayersPage'
import SessionsPage from './pages/SessionsPage'

const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const PlayerDetailPage = lazy(() => import('./pages/PlayerDetailPage'))
const PlayerReportPage = lazy(() => import('./pages/PlayerReportPage'))
const TeamReportPage = lazy(() => import('./pages/TeamReportPage'))
const SessionTeamReportPage = lazy(() => import('./pages/SessionTeamReportPage'))
const SessionPlayerReportPage = lazy(() => import('./pages/SessionPlayerReportPage'))
const SeasonsPage = lazy(() => import('./pages/SeasonsPage'))

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
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
