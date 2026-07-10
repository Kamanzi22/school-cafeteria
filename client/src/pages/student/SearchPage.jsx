import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Clock, Star, MapPin, Timer, CheckCircle,
  Store, Package, ShoppingCart, ChevronRight
} from 'lucide-react'
import { restaurantAPI, menuAPI } from '../../services/api'
import { useCartStore, useUIStore, useVenueStore } from '../../store'

const HISTORY_KEY = 'cc-search-history'
const MAX_HISTORY = 8

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function saveToHistory(term) {
  if (!term.trim()) return
  const prev = getHistory().filter(t => t.toLowerCase() !== term.toLowerCase())
  localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...prev].slice(0, MAX_HISTORY)))
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

function FilterTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-alu-red text-white shadow-sm'
          : 'bg-alu-surface border border-alu-border text-alu-muted hover:text-alu-cream hover:border-alu-muted/50'
      }`}
    >
      {active && <CheckCircle size={13} className="shrink-0" />}
      {label}
    </button>
  )
}

function ProductCard({ item }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/restaurant/${item.restaurant.id}`)}
      className="flex items-start gap-3 py-4 cursor-pointer hover:bg-alu-card px-4 -mx-4 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-bold text-alu-cream text-base leading-snug">{item.name}</p>
        {item.description && (
          <p className="text-sm text-alu-muted mt-0.5 line-clamp-1">{item.description}</p>
        )}
        <p className="font-bold text-alu-cream mt-1">RWF {item.price.toLocaleString()}</p>
        <p className="text-xs text-alu-muted mt-0.5">Vendor: {item.restaurant.name}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-alu-muted">
          <span className="flex items-center gap-1">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {item.restaurant.ratingCount > 0 ? item.restaurant.rating.toFixed(1) : '—'}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {item.restaurant.floor || item.restaurant.location || 'Campus'}
          </span>
          <span>DF: Free</span>
          <span className="flex items-center gap-1">
            <Timer size={11} />
            {item.restaurant.prepTimeMin}–{item.restaurant.prepTimeMax} min
          </span>
        </div>
      </div>
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
        style={{ background: `${item.restaurant.coverColor}22` }}
      >
        {item.emoji}
      </div>
    </div>
  )
}

function MerchantCard({ r }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/restaurant/${r.id}`)}
      className="flex items-start gap-3 py-4 cursor-pointer hover:bg-alu-card px-4 -mx-4 transition-colors"
    >
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
        style={{ background: `${r.coverColor}22` }}
      >
        {r.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-alu-cream text-base leading-snug">{r.name}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.isOpen ? 'badge-open' : 'badge-closed'}`}>
            {r.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <p className="text-sm text-alu-muted mt-0.5 line-clamp-1">{r.description}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-alu-muted">
          <span className="flex items-center gap-1">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {r.ratingCount > 0 ? r.rating.toFixed(1) : '—'}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {r.location || 'Campus'}
          </span>
          <span className="flex items-center gap-1">
            <Timer size={11} /> {r.prepTimeMin}–{r.prepTimeMax} min
          </span>
        </div>
      </div>
      <ChevronRight size={16} className="text-alu-muted mt-1 shrink-0" />
    </div>
  )
}

function BottomNav() {
  const navigate = useNavigate()
  const { openCart } = useUIStore()
  const { count } = useCartStore()
  const cartCount = count()

  const tabs = [
    { label: 'Store Front', icon: Store, action: () => navigate('/') },
    { label: 'Orders', icon: Package, action: () => navigate('/orders') },
    { label: 'Cart', icon: ShoppingCart, action: openCart, badge: cartCount > 0 ? cartCount : null },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-alu-surface border-t border-alu-border z-40">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {tabs.map(({ label, icon: Icon, action, badge }) => (
          <button key={label} onClick={action} className="flex flex-col items-center gap-0.5 px-3 py-1 text-alu-muted hover:text-alu-cream transition-colors relative">
            <div className="relative">
              <Icon size={20} />
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-alu-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [restaurants, setRestaurants] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(getHistory)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)
  const { venueType } = useVenueStore()
  const isMarketplace = venueType === 'MARKETPLACE'

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setRestaurants([]); setProducts([]); return }

    setLoading(true)
    const q = query.trim()

    const fetchMerchants = (filter === 'all' || filter === 'merchants')
      ? restaurantAPI.search(q, venueType).then(r => r.data.data)
      : Promise.resolve([])

    const fetchProducts = (filter === 'all' || filter === 'products')
      ? menuAPI.search(q, venueType).then(r => r.data.data)
      : Promise.resolve([])

    debounceRef.current = setTimeout(() => {
      Promise.all([fetchMerchants, fetchProducts]).then(([rests, items]) => {
        setRestaurants(rests)
        setProducts(items)
        setLoading(false)
        if (rests.length + items.length > 0) {
          saveToHistory(q)
          setHistory(getHistory())
        }
      }).catch(() => setLoading(false))
    }, 350)

    return () => clearTimeout(debounceRef.current)
  }, [query, filter, venueType])

  const handleHistoryClick = (term) => {
    setQuery(term)
    inputRef.current?.focus()
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  const isSearching = query.trim().length > 0

  const shownRestaurants = filter === 'products' ? [] : restaurants
  const shownProducts = filter === 'merchants' ? [] : products
  const totalCount = shownRestaurants.length + shownProducts.length

  return (
    <div className="min-h-screen bg-alu-bg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-alu-surface border-b border-alu-border px-4 pt-4 pb-3">
        <h1 className="text-xl font-black text-alu-cream mb-3">Search</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-0.5">
          {[['all', 'All'], ['merchants', isMarketplace ? 'Stores' : 'Restaurants'], ['products', isMarketplace ? 'Products' : 'Meals']].map(([val, label]) => (
            <FilterTab key={val} label={label} active={filter === val} onClick={() => setFilter(val)} />
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-alu-muted pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isMarketplace ? 'Search for a product' : 'Search for a meal'}
            className="input pl-10 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-alu-muted hover:text-alu-cream transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* Empty state: search history */}
        {!isSearching && (
          <div className="pt-4">
            {history.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-alu-cream text-sm">Your search history</p>
                  <button onClick={handleClearHistory} className="text-alu-red hover:text-red-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {history.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleHistoryClick(term)}
                      className="flex items-center gap-2 bg-alu-surface border border-alu-border rounded-full px-3 py-2 text-sm text-alu-cream hover:bg-alu-card transition-colors text-left"
                    >
                      <Clock size={13} className="text-alu-muted shrink-0" />
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <Search size={40} className="text-alu-border mx-auto mb-3" />
                <p className="text-alu-muted text-sm">Search for restaurants or meals</p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {isSearching && loading && (
          <div className="pt-8 flex flex-col items-center gap-2 text-alu-muted">
            <div className="w-6 h-6 border-2 border-alu-border border-t-alu-red rounded-full animate-spin" />
            <p className="text-sm">Searching…</p>
          </div>
        )}

        {/* Results */}
        {isSearching && !loading && (
          <>
            <p className="text-sm text-alu-muted pt-4 pb-2">
              {totalCount} result{totalCount !== 1 ? 's' : ''} found
            </p>

            {totalCount === 0 && (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-bold text-alu-cream">No results for "{query}"</p>
                <p className="text-alu-muted text-sm mt-1">Try a different term or filter</p>
              </div>
            )}

            {shownRestaurants.length > 0 && (
              <div>
                <p className="font-bold text-alu-cream text-sm mb-1">
                  {isMarketplace ? 'Stores' : 'Restaurants'} ({shownRestaurants.length})
                </p>
                <div className="divide-y divide-alu-border">
                  {shownRestaurants.map(r => <MerchantCard key={r.id} r={r} />)}
                </div>
              </div>
            )}

            {shownProducts.length > 0 && (
              <div className={shownRestaurants.length > 0 ? 'mt-4' : ''}>
                <p className="font-bold text-alu-cream text-sm mb-1">
                  {isMarketplace ? 'Products' : 'Meals'} ({shownProducts.length})
                </p>
                <div className="divide-y divide-alu-border">
                  {shownProducts.map(item => <ProductCard key={item.id} item={item} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
