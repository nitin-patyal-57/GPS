import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  Compass,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Redirect destination after login
  const from = (location.state as any)?.from?.pathname || '/'

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setIsLoading(true)

    // Simulate quick auth delay for realistic polished UX
    await new Promise((r) => setTimeout(r, 400))

    const result = await login(email, password)
    setIsLoading(false)

    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Authentication failed. Please verify credentials.')
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Background Ambient Glow & Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

      {/* Top Bar for Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition backdrop-blur-md"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 mb-4 ring-4 ring-emerald-500/10">
            <Compass className="h-8 w-8 text-white animate-spin-slow" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            GPS Fleet Portal
          </h1>
          <p className="text-xs text-emerald-400 font-mono font-medium mt-1">
            Walnut Medical IoT Telemetry
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Sign in with authorized administrator credentials to access real-time GNSS tracking
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email / Username Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Email / Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@walnutmedical.in"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 focus:border-emerald-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-10 text-xs font-medium text-white placeholder-slate-500 focus:border-emerald-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Info Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Protected by 256-bit TLS & AWS IoT Core Session</span>
        </div>
      </div>
    </div>
  )
}
