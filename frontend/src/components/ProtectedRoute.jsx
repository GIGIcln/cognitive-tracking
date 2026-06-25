import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PendingPage from '../pages/PendingPage'

export default function ProtectedRoute() {
  const { user, isLoading, isPending } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isPending) {
    return <PendingPage />
  }

  return <Outlet />
}
