import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { RefreshProvider } from '@/context/RefreshContext'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

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
      <RefreshProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner message="Loading GPS Dashboard..." className="min-h-screen" />}>
              <Routes>
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
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </RefreshProvider>
    </ThemeProvider>
  )
}
