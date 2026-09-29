import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAdminStore } from './store'
import { useOrderNotifications } from './hooks/useOrderNotifications'
import { useRestaurantOrderNotifications } from './hooks/useRestaurantOrderNotifications'
import { usePwaScope } from './hooks/usePwaScope'
import { useAppUpdateCheck } from './hooks/useAppUpdateCheck'
import OfflineScreen from './components/shared/OfflineScreen'
import { portalHome } from './portal'

// Customer-facing
import HomePage from './pages/student/HomePage'
import RestaurantPage from './pages/student/RestaurantPage'
import OrderConfirmPage from './pages/student/OrderConfirmPage'
import TrackOrderPage from './pages/student/TrackOrderPage'
import OrderHistoryPage from './pages/student/OrderHistoryPage'
import CustomerAuthPage from './pages/student/CustomerAuthPage'
import CustomerProfilePage from './pages/student/CustomerProfilePage'
import SearchPage from './pages/student/SearchPage'
import PrivacyPage from './pages/PrivacyPage'

// Restaurant admin, super admin and delivery screens are split into their own chunks so
// customers don't download them — they load the first time one of those routes is opened.
const RestaurantAuthPage = lazy(() => import('./pages/restaurant/RestaurantAuthPage'))
const DashboardPage = lazy(() => import('./pages/restaurant/DashboardPage'))
const MenuPage = lazy(() => import('./pages/restaurant/MenuPage'))
const SalesReportPage = lazy(() => import('./pages/restaurant/SalesReportPage'))
const RestaurantOrderHistoryPage = lazy(() => import('./pages/restaurant/OrderHistoryPage'))
const PromotionsPage = lazy(() => import('./pages/restaurant/PromotionsPage'))
const ReviewsPage = lazy(() => import('./pages/restaurant/ReviewsPage'))
const SettingsPage = lazy(() => import('./pages/restaurant/SettingsPage'))

const SuperAdminPage = lazy(() => import('./pages/admin/SuperAdminPage'))
const DeliveryPage = lazy(() => import('./pages/admin/DeliveryPage'))
const DeliveryAuthPage = lazy(() => import('./pages/admin/DeliveryAuthPage'))

function AdminGuard({ children }) {
  const { restaurant } = useAdminStore()
  return restaurant ? children : <Navigate to="/restaurant/auth" replace />
}

export default function App() {
  useOrderNotifications()
  useRestaurantOrderNotifications()
  usePwaScope()
  useAppUpdateCheck()
  return (
    <>
    <OfflineScreen />
    <Suspense fallback={null}>
    <Routes>
      {/* ── Customer side ──────────────────────────────── */}
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/auth" element={<CustomerAuthPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/profile" element={<CustomerProfilePage />} />
      <Route path="/restaurant/:id" element={<RestaurantPage />} />
      <Route path="/order/confirm/:id" element={<OrderConfirmPage />} />
      <Route path="/order/track/:id" element={<TrackOrderPage />} />
      <Route path="/orders" element={<OrderHistoryPage />} />

      {/* ── Restaurant admin ───────────────────────────── */}
      <Route path="/restaurant/auth" element={<RestaurantAuthPage />} />
      <Route path="/restaurant/auth/:tab" element={<RestaurantAuthPage />} />
      <Route path="/admin" element={<AdminGuard><DashboardPage /></AdminGuard>} />
      <Route path="/admin/menu" element={<AdminGuard><MenuPage /></AdminGuard>} />
      <Route path="/admin/orders" element={<AdminGuard><RestaurantOrderHistoryPage /></AdminGuard>} />
      <Route path="/admin/sales-report" element={<AdminGuard><SalesReportPage /></AdminGuard>} />
      <Route path="/admin/promotions" element={<AdminGuard><PromotionsPage /></AdminGuard>} />
      <Route path="/admin/reviews" element={<AdminGuard><ReviewsPage /></AdminGuard>} />
      <Route path="/admin/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />

      {/* ── Super admin ────────────────────────────────── */}
      <Route path="/superadmin" element={<SuperAdminPage />} />
      <Route path="/superadmin/delivery" element={<DeliveryPage />} />

      {/* ── Delivery runner (scoped, standalone) ───────── */}
      <Route path="/delivery/login" element={<DeliveryAuthPage />} />
      <Route path="/delivery" element={<DeliveryPage standalone />} />

      <Route path="*" element={<Navigate to={portalHome || '/'} replace />} />
    </Routes>
    </Suspense>
    </>
  )
}
