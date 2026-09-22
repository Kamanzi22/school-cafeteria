import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, LogOut, ShoppingBag, Star, User, Mail, Phone, Hash, UserPlus } from 'lucide-react'
import { useCustomerStore } from '../../store'
import { customerAPI } from '../../services/api'
import { useBackNavigate } from '../../hooks/useBackNavigate'
import { disablePush } from '../../services/push'
import NotificationSettings from '../../components/student/NotificationSettings'
import InstallApp from '../../components/student/InstallApp'
import toast from 'react-hot-toast'

export default function CustomerProfilePage() {
  const { customer, logout, login } = useCustomerStore()
  const navigate = useNavigate()
  const goBack = useBackNavigate()

  if (!customer) return <Navigate to="/auth" replace />
  const isGuest = customer.accountType === 'guest'

  const handleLogout = async () => {
    if (isGuest) {
      try { await customerAPI.deleteGuest(customer.id) } catch {}
    }
    // Before logout() clears the token — the server call needs it, and the next person on a
    // shared phone shouldn't get this customer's order alerts.
    await disablePush()
    logout()
    navigate('/')
    toast.success('Signed out')
  }

  return (
    <div className="min-h-dvh bg-alu-bg">
      <div className="bg-alu-surface border-b border-alu-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="btn btn-ghost btn-icon"><ArrowLeft size={18}/></button>
          <h1 className="font-bold text-alu-cream">My Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Avatar */}
        <div className="card p-6 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-black text-white ${isGuest ? 'bg-alu-muted/40' : 'gradient-brand'}`}>
            {isGuest ? '👤' : customer.name[0]}
          </div>
          <h2 className="font-black text-xl text-alu-cream">{customer.name}</h2>
          {isGuest ? (
            <span className="badge-warning mt-1">Guest Account</span>
          ) : (
            <>
              {customer.email && <p className="text-alu-muted text-sm mt-1">{customer.email}</p>}
              {customer.studentId && <p className="text-xs text-alu-muted">Student ID: {customer.studentId}</p>}
              {customer.department && <p className="text-xs text-alu-muted">{customer.department} · {customer.year}</p>}
            </>
          )}
        </div>

        {/* Guest upgrade prompt */}
        {isGuest && (
          <div className="card p-5 border-alu-red/20 bg-alu-red/5">
            <div className="flex items-start gap-3">
              <UserPlus size={20} className="text-alu-red mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-alu-cream text-sm">Create a full account</p>
                <p className="text-xs text-alu-muted mt-0.5">Save your order history, earn points, and access your orders from any device.</p>
                <Link to="/auth?tab=register" className="btn btn-primary btn-sm mt-3">Create account with Google</Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {!isGuest && (
          <div className="grid grid-cols-3 gap-3">
            {[['Orders', customer.orderCount||0],['RWF Spent', (customer.totalSpent||0).toLocaleString()],['Points', customer.points||0]].map(([l,v]) => (
              <div key={l} className="card p-4 text-center">
                <p className="font-black text-alu-cream text-lg leading-tight">{v}</p>
                <p className="text-xs text-alu-muted mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        )}

        <InstallApp />
        <NotificationSettings />

        <Link to="/orders" className="btn btn-secondary w-full"><ShoppingBag size={16}/>My Orders</Link>
        <button onClick={handleLogout} className="btn btn-danger w-full"><LogOut size={16}/>Sign Out</button>
      </div>
    </div>
  )
}
