import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, getMe, logout as apiLogout } from '../api/auth'
import { clearQueue } from '../utils/offlineQueue'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigateRef = useRef(null)
  const navigate = useNavigate()
  navigateRef.current = navigate

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err?.response?.status !== 401) {
          console.warn('[Auth] Session check failed unexpectedly:', err)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await apiLogin(email, password)
    setUser(res.data.user)
  }

  const logout = async () => {
    try { await apiLogout() } catch {}
    try { await clearQueue() } catch {}
    setUser(null)
    navigateRef.current('/login', { replace: true })
  }

  const isAdmin = user?.roles?.includes('admin') ?? false

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
