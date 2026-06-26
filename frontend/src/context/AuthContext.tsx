import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, getMe, logout as apiLogout } from '../api/auth'
import { clearQueue } from '../utils/offlineQueue'

interface AuthUser {
  full_name?: string
  email?: string
  roles?: string[]
  status?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isStaff: boolean
  isPending: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigateRef = useRef<ReturnType<typeof useNavigate> | null>(null)
  const navigate = useNavigate()
  navigateRef.current = navigate

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data as AuthUser))
      .catch((err: unknown) => {
        const typedErr = err as { response?: { status?: number } }
        if (typedErr?.response?.status !== 401) {
          console.warn('[Auth] Session check failed unexpectedly:', err)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const res = await apiLogin(email, password)
    setUser((res.data as { user: AuthUser }).user)
  }

  const logout = async (): Promise<void> => {
    try { await apiLogout() } catch {}
    try { await clearQueue() } catch {}
    setUser(null)
    navigateRef.current!('/login', { replace: true })
  }

  const isAdmin = user?.roles?.includes('admin') ?? false
  const isStaff = user?.roles?.some((r) => ['admin', 'responsabile_tecnico'].includes(r)) ?? false
  const isPending = user?.status === 'pending'

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin, isStaff, isPending }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
