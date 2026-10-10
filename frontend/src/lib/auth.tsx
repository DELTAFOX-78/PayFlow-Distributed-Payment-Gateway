import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, decodeToken, session } from './api'

interface AuthState {
  token: string | null
  merchantId?: string
  role?: string
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => session.token)

  const logout = useCallback(() => {
    session.token = null
    session.apiKey = null
    setToken(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await api.login({ email, password })
    session.token = accessToken
    setToken(accessToken)
  }, [])

  useEffect(() => {
    window.addEventListener('rzp:unauthorized', logout)
    return () => window.removeEventListener('rzp:unauthorized', logout)
  }, [logout])

  const value = useMemo<AuthState>(() => {
    const claims = decodeToken(token)
    // An expired token is as good as none.
    const expired = claims?.exp ? claims.exp * 1000 < Date.now() : false
    return { token: expired ? null : token, merchantId: claims?.merchantId, role: claims?.role, login, logout }
  }, [token, login, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
