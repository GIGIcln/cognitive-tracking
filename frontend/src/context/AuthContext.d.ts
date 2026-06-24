import type { ReactNode, ReactElement } from 'react'

export interface AuthContextValue {
  user: unknown
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export declare function useAuth(): AuthContextValue | null
export declare function AuthProvider(props: { children: ReactNode }): ReactElement
