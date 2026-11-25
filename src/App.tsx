import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { RefreshProvider } from '@/context/RefreshContext'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OverviewPage = lazy(() => import('@/pages/OverviewPage'))
const GpsTrackersPage = lazy(() => import('@/pages/GpsTrackersPage'))
const GpsDetailPage = lazy(() => import('@/pages/GpsDetailPage'))
const LiveMapPage = lazy(() => import('@/pages/LiveMapPage'))
const RouteHistoryPage = lazy(() => import('@/pages/RouteHistoryPage'))
const DrivingAnalyticsPage = lazy(() => import('@/pages/DrivingAnalyticsPage'))
const BatteryPowerPage = lazy(() => import('@/pages/BatteryPowerPage'))
const OtaUpdatesPage = lazy(() => import('@/pages/OtaUpdatesPage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RefreshProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner message="Loading GPS Dashboard..." className="min-h-screen" />}>
                <Routes>
                  {/* Public Authentication Route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected Fleet Tracking Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<OverviewPage />} />
                      <Route path="/devices" element={<GpsTrackersPage />} />
                      <Route path="/devices/:id" element={<GpsDetailPage />} />
                      <Route path="/map" element={<LiveMapPage />} />
                      <Route path="/history" element={<RouteHistoryPage />} />
                      <Route path="/analytics" element={<DrivingAnalyticsPage />} />
                      <Route path="/battery" element={<BatteryPowerPage />} />
                      <Route path="/ota" element={<OtaUpdatesPage />} />
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </RefreshProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
