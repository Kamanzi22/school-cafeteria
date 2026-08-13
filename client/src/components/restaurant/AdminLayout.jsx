import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, Receipt, Tag, Star, Settings, LogOut, ToggleLeft, ToggleRight, Bell, ChevronRight, Eye, X } from 'lucide-react'
import { useAdminStore } from '../../store'
import { restaurantAPI } from '../../services/api'
import { useState } from 'react'
import toast from 'react-hot-toast'

const navFor = (venueType) => [
  { path: '/admin', icon: LayoutDashboard, label: 'Live Orders' },
  { path: '/admin/menu', icon: UtensilsCrossed, label: venueType === 'MARKETPLACE' ? 'Products' : 'Menu' },
  { path: '/admin/sales-report', icon: Receipt, label: 'Sales Report' },
  { path: '/admin/promotions', icon: Tag, label: 'Promotions' },
  { path: '/admin/reviews', icon: Star, label: 'Reviews' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminLayout({ children, newOrderCount = 0 }) {
  const { admin, restaurant, role, logout, updateRestaurant } = useAdminStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [toggling, setToggling] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isViewer = role === 'viewer'
  const NAV = navFor(restaurant?.venueType)

  const handleToggle = async () => {
    setToggling(true)
    try {
      const res = await restaurantAPI.toggleOpen()
      updateRestaurant({ isOpen: res.data.data.isOpen })
      toast.success(res.data.data.isOpen ? '🟢 Now OPEN' : '🔴 Now CLOSED')
    } catch { toast.error('Failed') }
    finally { setToggling(false) }
  }

  const handleLogout = () => { logout(); navigate('/restaurant/auth') }
  const exitViewer = () => { logout(); navigate('/superadmin') }

  const isOpen = restaurant?.isOpen

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{restaurant?.emoji}</span>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight truncate">{restaurant?.name}</p>
            <p className="text-ink-500 text-xs capitalize">{admin?.role}</p>
          </div>
        </div>
      </div>

      {/* Open/Close toggle — read-only status pill for a viewer, real toggle for staff/owner */}
      <div className="px-4 py-3 border-b border-white/10">
        {isViewer ? (
          <div className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-sm ${isOpen ? 'bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20' : 'bg-red-500/10 text-red-400/80 border border-red-500/20'}`}>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {isOpen ? 'Open for orders' : 'Store closed'}
            </span>
            <Eye size={15} />
          </div>
        ) : (
          <button onClick={handleToggle} disabled={toggling}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${isOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {isOpen ? 'Open for orders' : 'Store closed'}
            </span>
            {isOpen ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = location.pathname === n.path
          return (
            <Link key={n.path} to={n.path} onClick={() => setSidebarOpen(false)}
              className={`nav-item ${active ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <n.icon size={17} />
              <span className="flex-1">{n.label}</span>
              {n.path === '/admin' && newOrderCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {newOrderCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        {isViewer ? (
          <button onClick={exitViewer} className="nav-item nav-item-inactive w-full text-brand-400 hover:bg-brand-500/10">
            <X size={17} />Exit to Super Admin
          </button>
        ) : (
          <button onClick={handleLogout} className="nav-item nav-item-inactive w-full text-red-400 hover:bg-red-500/10">
            <LogOut size={17} />Sign Out
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 gradient-dark flex-col min-h-screen shrink-0 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink-950/70" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 gradient-dark z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0">
        {isViewer && (
          <div className="sticky top-0 z-30 bg-brand-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="flex items-center gap-2"><Eye size={15} /> Viewing {restaurant?.name} as Super Admin — read only, live</span>
            <button onClick={exitViewer} className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1 text-xs transition-colors shrink-0">
              <X size={12} /> Exit
            </button>
          </div>
        )}
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ink-100 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
            <LayoutDashboard size={18} />
          </button>
          <span className="font-bold text-ink-900 text-sm">{restaurant?.name}</span>
          <div className="flex items-center gap-1">
            {newOrderCount > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{newOrderCount}</span>}
            <Link to="/admin" className="btn btn-ghost btn-icon"><Bell size={18} /></Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
