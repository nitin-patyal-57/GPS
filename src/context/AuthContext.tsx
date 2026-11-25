import React, { createContext, useContext, useState, useEffect } from 'react'

export interface AuthUser {
  email: string
  name: string
  role: string
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {}
    return null
  })

  const isAuthenticated = Boolean(user)

  const login = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = emailInput.trim().toLowerCase()
    const cleanPass = passwordInput.trim()

    // Accept either 'admin' or 'admin@walnutmedical.in'
    const isEmailValid = cleanEmail === ADMIN_CREDENTIALS.email || cleanEmail === ADMIN_CREDENTIALS.username
    const isPassValid = cleanPass === ADMIN_CREDENTIALS.password

    if (isEmailValid && isPassValid) {
      const authUser: AuthUser = {
        email: ADMIN_CREDENTIALS.email,
        name: 'Administrator',
        role: 'Fleet Admin',
      }
      setUser(authUser)
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      } catch {}
      return { success: true }
    }

    return {
      success: false,
      error: 'Invalid email or password. Please check your credentials.',
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
