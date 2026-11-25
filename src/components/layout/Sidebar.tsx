import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Navigation,
  MapPin,
  Clock,
  Activity,
  Battery,
  Bell,
  Settings,
  X,
  Compass,
  UploadCloud,
  LogOut,
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAuth } from '@/context/AuthContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/devices', icon: Navigation, label: 'GPS Trackers' },
  { to: '/map', icon: MapPin, label: 'Live Map' },
  { to: '/history', icon: Clock, label: 'Route History' },
  { to: '/analytics', icon: Activity, label: 'Driving Dynamics' },
  { to: '/battery', icon: Battery, label: 'Battery & Power' },
  { to: '/ota', icon: UploadCloud, label: 'OTA Updates' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth()

  const handleLogout = () => {
    onClose()
    logout()
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 flex flex-col',
          'bg-slate-900 border-r border-slate-800',
          'transition-all duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <span className="text-base font-black text-white tracking-tight">GPS TRACKER</span>
              <p className="text-[10px] text-emerald-400 font-mono font-medium">AWS IoT Live Telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0',
                      isActive ? 'text-emerald-400' : 'text-slate-500'
                    )}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Authenticated Admin User & Logout */}
        <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
              A
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">Administrator</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">admin@walnutmedical.in</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span>Protocol</span>
            <span className="font-mono text-slate-300 font-bold">MQTT over TLS</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Broker</span>
            <span className="font-mono text-slate-300">AWS IoT Core</span>
          </div>
        </div>
      </aside>
    </>
  )
}
