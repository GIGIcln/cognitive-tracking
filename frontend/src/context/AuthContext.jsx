import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, getMe, logout as apiLogout } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigateRef = useRef(null)
  const navigate = useNavigate()
  navigateRef.current = navigate

  useEffect(() => {
    const token = localStorage.getItem('ct_token')
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('ct_token'))
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await apiLogin(email, password)
    localStorage.setItem('ct_token', res.data.access_token)
    const meRes = await getMe()
    setUser(meRes.data)
  }

  const logout = () => {
    apiLogout()
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

export const useAuth = () => useContext(AuthContext)
