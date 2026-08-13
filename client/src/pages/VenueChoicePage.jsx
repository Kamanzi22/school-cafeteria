import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, Building2, Globe, ArrowLeft } from 'lucide-react'
import { useVenueStore } from '../store'

const VENUES = [
  {
    type: 'CAFETERIA',
    emoji: '🍽️',
    icon: UtensilsCrossed,
    title: 'School Cafeteria',
    tagline: 'Order ahead from campus food stalls',
    color: '#f97316',
  },
  {
    type: 'MARKETPLACE',
    emoji: '🛍️',
    icon: ShoppingBag,
    title: 'Marketplace',
    tagline: 'Shop stores run by fellow students',
    color: '#6366f1',
  },
]

const STORE_MODES = [
  {
    mode: 'ON_CAMPUS',
    emoji: '🏬',
    icon: Building2,
    title: 'On Campus',
    tagline: 'Stores with a physical spot on campus',
    color: '#0ea5e9',
  },
  {
    mode: 'VIRTUAL',
    emoji: '🌐',
    icon: Globe,
    title: 'Virtual',
    tagline: 'Fully digital stores — shop from anywhere',
    color: '#a855f7',
  },
]

export default function VenueChoicePage() {
  const { venueType, setVenueType, setStoreMode } = useVenueStore()
  const [step, setStep] = useState(venueType === 'MARKETPLACE' ? 'mode' : 'venue')
  const navigate = useNavigate()

  const chooseVenue = (type) => {
    setVenueType(type)
    if (type === 'MARKETPLACE') { setStoreMode(null); setStep('mode') }
    else navigate('/')
  }

  const chooseMode = (mode) => {
    setStoreMode(mode)
    navigate('/')
  }

  return (
    <div className="min-h-screen gradient-dark flex items-center justify-center p-4">
      <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />
      <div className="w-full max-w-2xl relative z-10">
        {step === 'venue' ? (
          <>
            <div className="text-center mb-8 animate-fade-up">
              <span className="text-5xl mb-3 inline-block">🎓</span>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">Welcome to CaféCampus</h1>
              <p className="text-ink-400 text-sm mt-2">What are you here for today?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VENUES.map((v, i) => (
                <button
                  key={v.type}
                  onClick={() => chooseVenue(v.type)}
                  className="card-hover group text-left overflow-hidden flex flex-col animate-fade-up bg-white"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                >
                  <div className="h-28 flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${v.color}22, ${v.color}44)` }}>
                    <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{v.emoji}</span>
                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: v.color }} />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <v.icon size={16} style={{ color: v.color }} />
                      <h2 className="font-bold text-ink-900 text-lg">{v.title}</h2>
                    </div>
                    <p className="text-ink-400 text-sm">{v.tagline}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-ink-600 text-xs mt-8">You can switch between them anytime from the home screen.</p>
          </>
        ) : (
          <>
            <button onClick={() => setStep('venue')} className="flex items-center gap-1.5 text-ink-400 hover:text-white text-xs font-semibold mb-6 mx-auto">
              <ArrowLeft size={13} /> Back
            </button>
            <div className="text-center mb-8 animate-fade-up">
              <span className="text-5xl mb-3 inline-block">🛍️</span>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">Which stores?</h1>
              <p className="text-ink-400 text-sm mt-2">On-campus stores can be picked up in person — virtual stores are fully digital and reachable from anywhere.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STORE_MODES.map((v, i) => (
                <button
                  key={v.mode}
                  onClick={() => chooseMode(v.mode)}
                  className="card-hover group text-left overflow-hidden flex flex-col animate-fade-up bg-white"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                >
                  <div className="h-28 flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${v.color}22, ${v.color}44)` }}>
                    <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{v.emoji}</span>
                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: v.color }} />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <v.icon size={16} style={{ color: v.color }} />
                      <h2 className="font-bold text-ink-900 text-lg">{v.title}</h2>
                    </div>
                    <p className="text-ink-400 text-sm">{v.tagline}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
