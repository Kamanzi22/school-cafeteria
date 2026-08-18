import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, User, Star, Clock, MapPin, TrendingUp } from 'lucide-react'
import { restaurantAPI } from '../../services/api'
import { useCartStore, useCustomerStore, useUIStore } from '../../store'
import { useSocket } from '../../hooks/useSocket'
import CartDrawer from '../../components/student/CartDrawer'
import toast from 'react-hot-toast'

function RestaurantCard({ r, index, matchedItems }) {
  return (
    <Link to={`/restaurant/${r.id}`}
      className="card-hover group overflow-hidden flex flex-col animate-fade-up"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}>
      {/* Cover */}
      <div className="relative h-36 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${r.coverColor}22, ${r.coverColor}44)` }}>
        {r.logo
          ? <img src={r.logo} alt={r.name} className="w-20 h-20 object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300" />
          : <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{r.emoji}</span>}
        <div className="absolute top-3 right-3">
          <span className={r.isOpen ? 'badge-open' : 'badge-closed'}>
            {r.isOpen ? '● Open' : '● Closed'}
          </span>
        </div>
        {r._count?.orders > 50 && (
          <div className="absolute top-3 left-3 badge bg-flame-500/20 text-flame-300">
            <TrendingUp size={10} /> Popular
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: r.coverColor }} />
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-alu-cream text-sm leading-snug">{r.name}</h3>
          {r.ratingCount > 0 && (
            <div className="flex items-center gap-0.5 shrink-0 text-xs text-alu-muted">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span className="font-semibold text-alu-cream">{r.rating}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-alu-muted line-clamp-1 mb-3 flex-1">{r.description}</p>

        {/* Matched menu items */}
        {matchedItems?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {matchedItems.map(item => (
              <span key={item.id} className="inline-flex items-center gap-1 bg-brand-500/15 text-brand-300 text-[11px] font-medium px-2 py-0.5 rounded-full border border-brand-500/20">
                {item.emoji} {item.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-alu-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock size={11} /> {r.prepTimeMin}–{r.prepTimeMax} min
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {r.location}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const { customer: student } = useCustomerStore()
  const { count } = useCartStore()
  const { cartOpen, openCart, closeCart } = useUIStore()
  const cartCount = count()
  const navigate = useNavigate()

  useSocket({
    'restaurant:status': ({ restaurantId, isOpen }) =>
      setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, isOpen } : r))
  })

  useEffect(() => {
    setLoading(true)
    restaurantAPI.list()
      .then(r => { setRestaurants(r.data.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayed = restaurants

  return (
    <div className="min-h-screen bg-alu-bg">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-alu-bg/90 backdrop-blur-xl border-b border-alu-border">
        <div className="page-container py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 mr-1">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-bold text-alu-cream leading-none text-base">CaféCampus</p>
              <p className="text-[10px] text-alu-muted leading-none">School Cafeteria</p>
            </div>
          </Link>

          {/* Search — navigates to dedicated search page */}
          <button
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center gap-2 bg-alu-surface border border-alu-border rounded-xl px-3.5 py-2 text-sm text-alu-muted hover:bg-alu-card transition-colors"
          >
            <Search size={15} className="shrink-0" />
            Search restaurants or meals…
          </button>

          <div className="flex items-center gap-2">
            {student ? (
              <Link to="/profile" className="btn btn-ghost btn-icon">
                <User size={18} />
              </Link>
            ) : (
              <Link to="/auth" className="btn btn-secondary btn-sm">Sign in</Link>
            )}
            <button onClick={openCart} className="relative btn btn-primary btn-icon">
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="relative overflow-hidden gradient-dark text-white">
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="page-container py-10 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-2">
            Skip the line,<br /><span className="text-gradient">order ahead</span> — <span className="text-gradient">pickup or delivery.</span>
          </h1>
        </div>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10" style={{ background: '#ff5c1a' }} />
      </div>


      {/* Restaurant grid */}
      <main className="page-container py-6 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-alu-border">
                <div className="skeleton h-36" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-5xl mb-4">🍽️</p>
            <p className="font-bold text-alu-cream text-lg">No restaurants available</p>
            <p className="text-alu-muted text-sm mt-1">Check back soon</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-alu-muted mb-4">
              {displayed.length} restaurant{displayed.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map((r, i) => (
                <RestaurantCard key={r.id} r={r} index={i} matchedItems={r.items?.length > 0 ? r.items : null} />
              ))}
            </div>
          </>
        )}
      </main>

      <CartDrawer />
    </div>
  )
}
