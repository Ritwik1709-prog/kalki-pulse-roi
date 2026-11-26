import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type UserRole = 'Brand Marketer' | 'Data Scientist' | 'Agency Lead'

export interface AuthUser {
  id: number
  full_name: string
  brand_name: string
  role: UserRole | string
  email: string
  created_at: string
}

export interface SignupInput {
  full_name: string
  brand_name: string
  role: UserRole
  email: string
  password: string
}

interface AuthResponsePayload {
  access_token: string
  token_type: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  signup: (payload: SignupInput) => Promise<AuthUser>
  logout: () => void
}

const TOKEN_STORAGE_KEY = 'kalki_pulse_token'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: string[] }
      if (first?.msg) return first.msg
    }
  }
  return fallback
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error(
      `Cannot reach KALKI Pulse Auth Gateway (${API_BASE_URL}). Start FastAPI with uvicorn on port 8000.`
    )
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Authentication request failed (${response.status}).`))
  }

  return body as T
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
    setToken(null)
    setUser(null)
  }, [])

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    } catch {
      // ignore storage errors
    }
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  // Validate persisted JWT on initial mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    apiRequest<AuthUser>('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((profile) => {
        if (!cancelled) {
          setUser(profile)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession()
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, clearSession])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const data = await apiRequest<AuthResponsePayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      persistSession(data.access_token, data.user)
      return data.user
    },
    [persistSession]
  )

  const signup = useCallback(
    async (payload: SignupInput): Promise<AuthUser> => {
      const data = await apiRequest<AuthResponsePayload>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      persistSession(data.access_token, data.user)
      return data.user
    },
    [persistSession]
  )

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider.')
  }
  return ctx
}
