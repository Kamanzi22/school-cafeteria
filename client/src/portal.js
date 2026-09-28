import { createPath, parsePath } from 'react-router-dom'

// restaurant.cafecampus.org.rw and superadmin.cafecampus.org.rw serve this same build. Routes and
// links everywhere in the app keep their full internal paths (/admin/menu, /restaurant/auth,
// /superadmin/delivery); on a portal subdomain the router's history drops that prefix from the
// address bar (/menu, /auth, /delivery) and adds it back when reading it, so no page needs to
// know which domain it's on.
// Each entry is [internal prefix, address-bar prefix].
const PORTALS = {
  restaurant: {
    home: '/admin',
    prefixes: [['/restaurant/auth', '/auth'], ['/admin', '']],
  },
  superadmin: {
    home: '/superadmin',
    // "View restaurant" signs the super admin into the restaurant dashboard in this same tab (and
    // origin, since the view token lives in localStorage), so /admin* stays reachable here as-is.
    prefixes: [['/admin', '/admin'], ['/restaurant/auth', '/restaurant/auth'], ['/superadmin', '']],
  },
}

const sub = window.location.hostname.split('.')[0]
const portal = PORTALS[sub]
const mainOrigin = window.location.origin.replace(`//${sub}.`, '//')

export const portalHome = portal?.home

const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/')

// Internal path → address-bar path, or null for a path outside this portal (the customer site)
const toPublic = (path) => {
  const match = portal.prefixes.find(([internal]) => under(path, internal))
  return match ? (match[1] + path.slice(match[0].length)) || '/' : null
}

// Address-bar path → internal path. An address that's already internal (an old bookmark, the
// installed app's start_url, a push notification link) is taken as-is.
const toInternal = (path) => {
  if (portal.prefixes.some(([internal]) => under(path, internal))) return path
  const [internal, pub] = portal.prefixes.find(([, p]) => p && under(path, p)) || portal.prefixes.find(([, p]) => !p)
  const rest = path.slice(pub.length)
  return internal + (rest === '/' ? '' : rest)
}

// The internal path of the current page — what code outside the router should check instead of
// window.location.pathname
export const currentPath = () => (portal ? toInternal(window.location.pathname) : window.location.pathname)

// A history object for <unstable_HistoryRouter> that does the translation above; null off-portal
const createPortalHistory = () => {
  let action = 'POP'
  let listener = null
  const read = () => {
    const { pathname, search, hash } = window.location
    const st = window.history.state
    return { pathname: toInternal(pathname), search, hash, state: st?.usr ?? null, key: st?.key || 'default' }
  }

  // Tidy an old-style address (restaurant.…/admin/menu) into its short form
  const { pathname, search, hash } = window.location
  const clean = toPublic(toInternal(pathname))
  if (clean && clean !== pathname) window.history.replaceState(window.history.state, '', clean + search + hash)

  let location = read()
  window.addEventListener('popstate', () => {
    action = 'POP'
    location = read()
    listener?.({ action, location })
  })

  // { href, external }: paths outside this portal (e.g. a restaurant's public menu page) live on
  // the main domain, so they get a full URL there
  const resolve = (to) => {
    const loc = typeof to === 'string' ? parsePath(to) : to
    const path = loc.pathname ?? location.pathname
    const pub = toPublic(path)
    return pub === null
      ? { href: mainOrigin + createPath({ ...loc, pathname: path }), external: true }
      : { href: createPath({ ...loc, pathname: pub }), external: false }
  }

  const navigate = (replace) => (to, state) => {
    const { href, external } = resolve(to)
    if (external) { window.location.assign(href); return }
    const key = Math.random().toString(36).slice(2, 10)
    window.history[replace ? 'replaceState' : 'pushState']({ usr: state ?? null, key }, '', href)
    action = replace ? 'REPLACE' : 'PUSH'
    location = read()
    listener?.({ action, location })
  }

  return {
    get action() { return action },
    get location() { return location },
    createHref: (to) => resolve(to).href,
    push: navigate(false),
    replace: navigate(true),
    go: (n) => window.history.go(n),
    listen: (fn) => { listener = fn; return () => { if (listener === fn) listener = null } },
  }
}

export const portalHistory = portal ? createPortalHistory() : null
