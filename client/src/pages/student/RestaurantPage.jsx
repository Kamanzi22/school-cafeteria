import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Clock, MapPin, Phone, Plus, Minus, ShoppingBag, Flame, Leaf, Zap, AlertCircle, Heart, Search, X, PackageX } from 'lucide-react'
import { restaurantAPI } from '../../services/api'
import { useCartStore, useCustomerStore, useUIStore } from '../../store'
import CartDrawer from '../../components/student/CartDrawer'
import toast from 'react-hot-toast'

function VariantPickerModal({ item, onPick, onClose }) {
  const [selected, setSelected] = useState(null)
  const variants = item.variants || []

  return (
    <div className="fixed inset-0 bg-ink-950/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-lg text-ink-900">{item.name}</h2>
            <p className="text-xs text-ink-400">Choose an option</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-2">
          {variants.map(v => {
            const outOfStock = v.stock <= 0 || !v.isAvailable
            return (
              <button key={v.id} disabled={outOfStock} onClick={() => setSelected(v.id)}
                className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 text-left transition ${outOfStock ? 'opacity-40 cursor-not-allowed border-ink-100' : selected === v.id ? 'border-flame-500 bg-flame-50' : 'border-ink-100 hover:border-ink-200'}`}>
                <div>
                  <p className="font-semibold text-sm text-ink-900">{v.name}</p>
                  <p className="text-xs text-ink-400">
                    {outOfStock ? 'Out of stock' : v.stock <= 5 ? `Only ${v.stock} left` : 'In stock'}
                  </p>
                </div>
                <span className="font-bold text-sm text-flame-500 shrink-0">
                  {(item.price + v.priceDelta).toLocaleString()} RWF
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-5 pt-0">
          <button disabled={!selected} onClick={() => onPick(variants.find(v => v.id === selected))}
            className="btn btn-primary w-full btn-lg">
            Add to cart
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RestaurantPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [favorited, setFavorited] = useState(false)
  const [variantItem, setVariantItem] = useState(null)
  const { items, addItem, setQty } = useCartStore()
  const { customer: student } = useCustomerStore()
  const { openCart } = useUIStore()
  const cartCount = items.reduce((s, i) => s + i.qty, 0)

  useEffect(() => {
    restaurantAPI.get(id).then(r => {
      setRestaurant(r.data.data)
      setFavorited(r.data.data.isFavorited)
      const cats = [...new Set(r.data.data.items.map(i => i.category?.name).filter(Boolean))]
      setActiveCategory(cats[0] || null)
      setLoading(false)
    }).catch(() => { setLoading(false); navigate('/') })
  }, [id])

  const getQty = (itemId) => items.filter(i => i.id === itemId).reduce((s, i) => s + i.qty, 0)

  const handleAdd = (item, variant = null) => {
    if (!student) { toast.error('Sign in to order'); navigate('/auth'); return }
    if (item.hasVariants && !variant) { setVariantItem(item); return }
    if (variant && (variant.stock <= 0 || !variant.isAvailable)) { toast.error('That option is out of stock'); return }
    if (!variant && item.trackStock && item.stock <= 0) { toast.error('Out of stock'); return }
    addItem(
      { id: item.id, name: item.name, price: item.price, emoji: item.emoji },
      {
        id: restaurant.id, name: restaurant.name, emoji: restaurant.emoji,
        offersPickup: restaurant.offersPickup, offersDelivery: restaurant.offersDelivery, deliveryFee: restaurant.deliveryFee,
        offersCampusDelivery: restaurant.offersCampusDelivery, offersOffCampusDelivery: restaurant.offersOffCampusDelivery,
        campusDeliveryFee: restaurant.campusDeliveryFee, offCampusDeliveryFee: restaurant.offCampusDeliveryFee,
      },
      variant
    )
    toast.success(`${item.name} added!`)
    setVariantItem(null)
  }

  const categories = restaurant ? [...new Set(restaurant.items.map(i => i.category?.name).filter(Boolean))] : []
  const featuredItems = restaurant?.items.filter(i => i.isFeatured) || []

  const displayItems = restaurant?.items.filter(i => {
    const matchCat = !activeCategory || i.category?.name === activeCategory
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  }) || []

  if (loading) return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center">
      <div className="text-center animate-pulse"><div className="text-5xl mb-3">🍽️</div><p className="text-ink-400">Loading menu…</p></div>
    </div>
  )
  if (!restaurant) return null

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Hero */}
      <div className="relative text-white" style={{ background: `linear-gradient(160deg, ${restaurant.coverColor}dd, ${restaurant.coverColor}99)` }}>
        <div className="absolute inset-0 stripe-pattern opacity-30" />
        <div className="page-container relative z-10 pt-4 pb-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate(-1)} className="w-9 h-9 bg-black/20 hover:bg-black/30 rounded-xl flex items-center justify-center transition backdrop-blur-sm">
              <ArrowLeft size={18} />
            </button>
            <button onClick={openCart} className="relative w-9 h-9 bg-black/20 hover:bg-black/30 rounded-xl flex items-center justify-center transition backdrop-blur-sm">
              <ShoppingBag size={18} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-flame-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-float shrink-0 overflow-hidden">
              {restaurant.logo
                ? <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                : <span className="text-5xl">{restaurant.emoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`badge text-xs ${restaurant.isOpen ? 'bg-white/30 text-white' : 'bg-red-500/30 text-red-100'}`}>
                  {restaurant.isOpen ? '● Open' : '● Closed'}
                </span>
                {!restaurant.isAccepting && restaurant.isOpen && (
                  <span className="badge bg-amber-500/30 text-amber-100">Paused</span>
                )}
              </div>
              <h1 className="font-black text-2xl text-white leading-tight">{restaurant.name}</h1>
              <p className="text-white/70 text-sm mt-0.5 line-clamp-2">{restaurant.description}</p>
              <div className="flex items-center gap-4 mt-2 text-white/70 text-xs">
                {restaurant.ratingCount > 0 && <span className="flex items-center gap-1"><Star size={11} className="fill-amber-300 text-amber-300" />{restaurant.rating} ({restaurant.ratingCount})</span>}
                <span className="flex items-center gap-1"><Clock size={11} />{restaurant.prepTimeMin}–{restaurant.prepTimeMax} min</span>
                <span className="flex items-center gap-1"><MapPin size={11} />{restaurant.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice banner */}
      {restaurant.notice && (
        <div className="bg-amber-50 border-b border-amber-200 page-container py-2.5">
          <p className="text-amber-700 text-sm flex items-center gap-2"><AlertCircle size={14} className="shrink-0" />{restaurant.notice}</p>
        </div>
      )}

      {/* Closed banner */}
      {!restaurant.isOpen && (
        <div className="bg-red-50 border-b border-red-100 page-container py-3">
          <p className="text-red-600 font-semibold text-sm text-center">This restaurant is currently closed · Opens {restaurant.openTime}</p>
        </div>
      )}

      {/* Featured strip */}
      {featuredItems.length > 0 && (
        <div className="bg-white border-b border-ink-100">
          <div className="page-container py-4">
            <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Flame size={13} className="text-flame-500" /> Featured
            </p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
              {featuredItems.map(item => (
                <button key={item.id} onClick={() => setActiveCategory(item.category?.name)}
                  className="flex-none flex flex-col items-center gap-1.5 w-24 group">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition group-hover:scale-105"
                    style={{ background: `${restaurant.coverColor}18` }}>
                    {item.emoji}
                  </div>
                  <p className="text-xs font-medium text-ink-700 text-center leading-tight line-clamp-2">{item.name}</p>
                  <p className="text-xs font-bold text-flame-500">{item.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category tabs + search */}
      <div className="sticky top-0 z-20 bg-white border-b border-ink-100 shadow-sm">
        <div className="page-container">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeCategory === c ? 'border-flame-500 text-flame-600' : 'border-transparent text-ink-400 hover:text-ink-700'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="page-container py-4 pb-24">
        {/* Search within menu */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this menu…" className="input pl-9 py-2 text-sm" />
        </div>

        <div className="space-y-3">
          {displayItems.map(item => {
            const qty = getQty(item.id)
            const outOfStock = item.hasVariants
              ? item.variants?.every(v => v.stock <= 0 || !v.isAvailable)
              : item.trackStock && item.stock <= 0
            const canOrder = restaurant.isOpen && restaurant.isAccepting && item.isAvailable && !outOfStock
            const lowStock = !item.hasVariants && item.trackStock && item.stock > 0 && item.stock <= 5
            return (
              <div key={item.id} className={`card flex gap-4 p-4 transition-opacity ${!item.isAvailable ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-0.5">
                    <h3 className="font-semibold text-alu-cream text-sm">{item.name}</h3>
                    {item.isFeatured && <span className="badge bg-flame-100 text-flame-600 text-[10px]">★ Featured</span>}
                    {item.isPopular && <span className="badge bg-purple-100 text-purple-600 text-[10px]">🔥 Popular</span>}
                    {item.isVegan && <span className="tag-vegan text-[10px]">Vegan</span>}
                    {!item.isVegan && item.isVeg && <span className="tag-veg text-[10px]">Veg</span>}
                    {item.isSpicy && <span className="tag-spicy text-[10px]">Spicy 🌶</span>}
                    {lowStock && <span className="badge bg-amber-100 text-amber-600 text-[10px]">Only {item.stock} left</span>}
                    {outOfStock && <span className="badge bg-ink-100 text-ink-400 text-[10px]">Out of stock</span>}
                  </div>
                  {item.description && <p className="text-xs text-ink-400 mt-0.5 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="font-bold text-flame-500">{item.price.toLocaleString()} RWF{item.hasVariants ? '+' : ''}</span>
                    {item.originalPrice && <span className="text-xs text-ink-400 line-through">{item.originalPrice.toLocaleString()}</span>}
                    {item.calories && <span className="text-xs text-ink-400 flex items-center gap-0.5"><Flame size={10} />{item.calories} cal</span>}
                    <span className="text-xs text-ink-400 flex items-center gap-0.5"><Clock size={10} />{item.prepTime} min</span>
                  </div>
                  {item.allergens && JSON.parse(item.allergens).length > 0 && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />Contains: {JSON.parse(item.allergens).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 justify-between shrink-0">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
                    style={{ background: `${restaurant.coverColor}15` }}>
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl">{item.emoji}</div>}
                  </div>
                  {canOrder ? (
                    item.hasVariants ? (
                      <button onClick={() => handleAdd(item)} className="btn btn-primary btn-sm text-xs px-3 relative">
                        {qty > 0 ? `Add more (${qty})` : 'Select'}
                      </button>
                    ) : qty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty(`${item.id}:`, qty - 1)} className="w-7 h-7 rounded-lg border border-ink-200 flex items-center justify-center text-ink-600 hover:bg-red-50 hover:border-red-200 transition">
                          <Minus size={12} />
                        </button>
                        <span className="font-bold text-sm text-alu-cream w-4 text-center">{qty}</span>
                        <button onClick={() => handleAdd(item)} className="w-7 h-7 rounded-lg bg-flame-500 flex items-center justify-center text-white hover:bg-flame-600 transition">
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleAdd(item)} className="w-7 h-7 rounded-lg bg-flame-500 flex items-center justify-center text-white hover:bg-flame-600 transition active:scale-95">
                        <Plus size={14} />
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-ink-400 text-center">{outOfStock ? <PackageX size={16} className="mx-auto" /> : !item.isAvailable ? '86\'d' : 'Closed'}</span>
                  )}
                </div>
              </div>
            )
          })}
          {displayItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-ink-300 text-sm">No items match your search</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 px-4">
          <button onClick={openCart} className="btn btn-primary btn-lg shadow-glow-lg animate-scale-in">
            <ShoppingBag size={18} />
            {cartCount} item{cartCount > 1 ? 's' : ''} in cart
          </button>
        </div>
      )}

      {variantItem && (
        <VariantPickerModal item={variantItem} onClose={() => setVariantItem(null)} onPick={(v) => handleAdd(variantItem, v)} />
      )}

      <CartDrawer />
    </div>
  )
}
