import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import PlayersPage from './pages/PlayersPage'
import SessionsPage from './pages/SessionsPage'
import SessionDetailPage from './pages/SessionDetailPage'
import ReportsPage from './pages/ReportsPage'
import PlayerReportPage from './pages/PlayerReportPage'
import TeamReportPage from './pages/TeamReportPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/player/:playerId" element={<PlayerReportPage />} />
            <Route path="/reports/group/:groupId" element={<TeamReportPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
