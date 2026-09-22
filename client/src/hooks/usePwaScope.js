import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// The customer, restaurant and super admin apps are all one SPA on one origin, so "install this
// as its own app" means swapping which manifest (name/icon/start_url) the browser sees for
// whichever section is currently open — installing from /admin should relaunch straight into the
// restaurant dashboard, not the customer home. iOS reads this off the live DOM the moment someone
// taps Share → Add to Home Screen, so this only needs to stay in sync with the current route.
const SCOPES = [
  { test: (p) => p.startsWith('/superadmin'), manifest: '/manifest-superadmin.webmanifest', title: 'CaféCampus Admin' },
  { test: (p) => p.startsWith('/admin') || p.startsWith('/restaurant/auth'), manifest: '/manifest-restaurant.webmanifest', title: 'CaféCampus Restaurant' },
]
const DEFAULT_SCOPE = { manifest: '/manifest.webmanifest', title: 'CaféCampus' }

export const usePwaScope = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    const scope = SCOPES.find(s => s.test(pathname)) || DEFAULT_SCOPE
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', scope.manifest)
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', scope.title)
  }, [pathname])
}
