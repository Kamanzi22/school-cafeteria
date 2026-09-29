import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// The customer, restaurant and super admin apps are all one SPA on one origin, so "install this
// as its own app" — with its own name, not just the customer's — means swapping which manifest
// the browser sees for whichever section is currently open, plus the home-screen label (iOS
// reads apple-mobile-web-app-title off the live DOM the moment someone taps Share → Add to Home
// Screen) and the tab/window title, so the name is right everywhere: the install prompt, the
// home-screen icon, and the browser tab or app-switcher entry before/after installing.
// `pageTitle` is only set here for scopes with no per-page <Seo>/Helmet title of their own
// (restaurant admin, super admin) — the customer scope leaves document.title alone so it
// doesn't fight with Seo.jsx's more specific per-page titles.
const SCOPES = [
  { test: (p) => p.startsWith('/superadmin'), manifest: '/manifest-superadmin.webmanifest', homeScreenTitle: 'cafecampus-admin', pageTitle: 'cafecampus-admin' },
  { test: (p) => p.startsWith('/admin') || p.startsWith('/restaurant/auth'), manifest: '/manifest-restaurant.webmanifest', homeScreenTitle: 'cafecampus-resto', pageTitle: 'cafecampus-resto', light: true },
]
const DEFAULT_SCOPE = { manifest: '/manifest.webmanifest', homeScreenTitle: 'CaféCampus', pageTitle: null }
// The restaurant app is light only; everything else keeps the dark palette (see .theme-light in index.css)
const DARK_THEME_COLOR = '#121212'
const LIGHT_THEME_COLOR = '#ffffff'

export const usePwaScope = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    const scope = SCOPES.find(s => s.test(pathname)) || DEFAULT_SCOPE
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', scope.manifest)
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', scope.homeScreenTitle)
    if (scope.pageTitle) document.title = scope.pageTitle
    document.documentElement.classList.toggle('theme-light', !!scope.light)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scope.light ? LIGHT_THEME_COLOR : DARK_THEME_COLOR)
  }, [pathname])
}
