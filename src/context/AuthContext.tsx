import React, { createContext, useContext, useState, useEffect } from 'react'

export interface AuthUser {
  email: string
  name: string
  role: 'admin' | 'user'
}

interface AuthContextType {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AUTH_STORAGE_KEY = 'gps_tracker_auth_user'

const ADMIN_CREDENTIALS = {
  email: 'admin@walnutmedical.in',
  username: 'admin',
  password: 'Walnut@2016',
}

const USER_CREDENTIALS = {
  email: 'user@walnutmedical.in',
  username: 'user',
  password: 'WalnutMedical@2026',
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Normalize role
        if (parsed.email === ADMIN_CREDENTIALS.email || parsed.role === 'Fleet Admin') {
          parsed.role = 'admin'
        } else if (parsed.email === USER_CREDENTIALS.email) {
          parsed.role = 'user'
        }
        return parsed
      }
    } catch {}
    return null
  })

  const isAuthenticated = Boolean(user)

  const login = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = emailInput.trim().toLowerCase()
    const cleanPass = passwordInput.trim()

    // 1. Check Administrator credentials
    const isAdminEmail = cleanEmail === ADMIN_CREDENTIALS.email || cleanEmail === ADMIN_CREDENTIALS.username
    const isAdminPass = cleanPass === ADMIN_CREDENTIALS.password

    if (isAdminEmail && isAdminPass) {
      const authUser: AuthUser = {
        email: ADMIN_CREDENTIALS.email,
        name: 'Administrator',
        role: 'admin',
      }
      setUser(authUser)
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      } catch {}
      return { success: true }
    }

    // 2. Check Standard User credentials (restricted access - no settings)
    const isUserEmail = cleanEmail === USER_CREDENTIALS.email || cleanEmail === USER_CREDENTIALS.username
    const isUserPass = cleanPass === USER_CREDENTIALS.password

    if (isUserEmail && isUserPass) {
      const authUser: AuthUser = {
        email: USER_CREDENTIALS.email,
        name: 'Standard User',
        role: 'user',
      }
      setUser(authUser)
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      } catch {}
      return { success: true }
    }

    return {
      success: false,
      error: 'Invalid email or password. Please verify your credentials.',
    }
  }

  const logout = () => {
    setUser(null)
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
