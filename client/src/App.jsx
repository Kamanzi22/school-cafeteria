import { Routes, Route, Navigate } from 'react-router-dom'
import { useAdminStore } from './store'

// Customer-facing
import HomePage from './pages/student/HomePage'
import RestaurantPage from './pages/student/RestaurantPage'
import OrderConfirmPage from './pages/student/OrderConfirmPage'
import TrackOrderPage from './pages/student/TrackOrderPage'
import OrderHistoryPage from './pages/student/OrderHistoryPage'
import CustomerAuthPage from './pages/student/CustomerAuthPage'
import CustomerProfilePage from './pages/student/CustomerProfilePage'
import SearchPage from './pages/student/SearchPage'

// Restaurant admin
import RestaurantAuthPage from './pages/restaurant/RestaurantAuthPage'
import DashboardPage from './pages/restaurant/DashboardPage'
import MenuPage from './pages/restaurant/MenuPage'
import SalesReportPage from './pages/restaurant/SalesReportPage'
import PromotionsPage from './pages/restaurant/PromotionsPage'
import ReviewsPage from './pages/restaurant/ReviewsPage'
import SettingsPage from './pages/restaurant/SettingsPage'

// Super admin
import SuperAdminPage from './pages/admin/SuperAdminPage'
import DeliveryPage from './pages/admin/DeliveryPage'

function AdminGuard({ children }) {
  const { restaurant } = useAdminStore()
  return restaurant ? children : <Navigate to="/restaurant/auth" replace />
}

export default function App() {
  return (
    <Routes>
      {/* ── Customer side ──────────────────────────────── */}
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/auth" element={<CustomerAuthPage />} />
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
      <Route path="/admin/sales-report" element={<AdminGuard><SalesReportPage /></AdminGuard>} />
      <Route path="/admin/promotions" element={<AdminGuard><PromotionsPage /></AdminGuard>} />
      <Route path="/admin/reviews" element={<AdminGuard><ReviewsPage /></AdminGuard>} />
      <Route path="/admin/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />

      {/* ── Super admin ────────────────────────────────── */}
      <Route path="/superadmin" element={<SuperAdminPage />} />
      <Route path="/superadmin/delivery" element={<DeliveryPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
