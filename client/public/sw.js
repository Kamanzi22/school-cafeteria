// Service worker. Two jobs:
//  1. Order/message notifications while the browser/app is closed (push + notificationclick).
//  2. Keeping a copy of the app on the phone so opening it doesn't wait on the network (fetch).
//     Only the app's own page shells and build files are kept — API calls, live updates and
//     everything on other hosts go straight to the network untouched.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keep = [SHELL_CACHE, ASSET_CACHE]
  for (const name of await caches.keys()) if (name.startsWith('cc-') && !keep.includes(name)) await caches.delete(name)
  await self.clients.claim()
  // Keep a copy of each app's page from the start, so even the second visit opens instantly.
  // Best effort: a failure here only means that page is fetched normally on its next open.
  const cache = await caches.open(SHELL_CACHE)
  await Promise.all(['/', '/admin', '/superadmin'].map(async (path) => {
    try {
      const res = await fetch(path, { cache: 'no-store' })
      if (cacheable(res)) await cache.put(shellFor(path), res)
    } catch {}
  }))
})()))

// ─── App copy ─────────────────────────────────────────────────────────────────
const SHELL_CACHE = 'cc-shell-v1'
const ASSET_CACHE = 'cc-assets-v1'
// Old builds' files pile up with every deploy; keep only the most recent ones.
const MAX_ASSETS = 120

// Which HTML file the server sends for an address — must match the rewrites in render.yaml.
const shellFor = (path) => {
  if (path === '/superadmin' || path.startsWith('/superadmin/')) return '/superadmin.html'
  if (path === '/admin' || path.startsWith('/admin/') || path === '/restaurant/auth' || path.startsWith('/restaurant/auth/')) return '/admin.html'
  return '/index.html'
}

const cacheable = (res) => res && res.ok && res.type === 'basic' && !res.redirected

const trimAssets = async () => {
  const cache = await caches.open(ASSET_CACHE)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i])
}

// Opening the app: show the copy kept from the last visit straight away and fetch the current
// page in the background for next time. A tab that stays open still picks up a new build through
// useAppUpdateCheck. With no copy yet (first visit), it's an ordinary network request.
// A reload (pull-to-refresh, or useAppUpdateCheck / a failed chunk load reloading onto a new build)
// asks for the current page instead, falling back to the copy only when there's no connection.
const openPage = async (event, url) => {
  const cache = await caches.open(SHELL_CACHE)
  const key = shellFor(url.pathname)
  const cached = await cache.match(key)
  const fresh = fetch(event.request).then(async (res) => {
    if (cacheable(res)) await cache.put(key, res.clone())
    return res
  })
  const isReload = event.request.cache === 'no-cache' || event.request.cache === 'reload'
  if (cached && isReload) return fresh.catch(() => cached)
  if (cached) {
    event.waitUntil(fresh.catch(() => {}))
    return cached
  }
  return fresh
}

// Build files have the content hash in their name (/assets/main-AbC123.js), so a given address
// never changes — keep it forever once fetched.
const buildFile = async (event) => {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(event.request)
  if (cached) return cached
  const res = await fetch(event.request)
  if (cacheable(res)) event.waitUntil(cache.put(event.request, res.clone()).then(trimAssets).catch(() => {}))
  return res
}

// The loading-screen logo, shown before the app starts: keep a copy, refresh it in the background.
const splashLogo = async (event) => {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(event.request)
  const fresh = fetch(event.request).then(async (res) => {
    if (cacheable(res)) await cache.put(event.request, res.clone())
    return res
  })
  if (cached) { event.waitUntil(fresh.catch(() => {})); return cached }
  return fresh
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Page loads of app addresses (not of real files such as /sitemap.xml or /robots.txt)
  if (req.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(url.pathname)) { event.respondWith(openPage(event, url)); return }
  if (url.pathname.startsWith('/assets/')) { event.respondWith(buildFile(event)); return }
  if (url.pathname === '/logo-mark.svg') { event.respondWith(splashLogo(event)); return }
  // Anything else (manifests, icons, the update check's own page fetch…) goes to the network as before
})

// ─── Notifications ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  // Always show something: browsers (iOS especially) revoke a subscription whose pushes are silent.
  event.waitUntil(self.registration.showNotification(data.title || 'CaféCampus', {
    body: data.body || '',
    tag: data.tag,
    // Each status update for an order reuses its tag so they replace each other instead of
    // stacking — renotify makes the replacement buzz/sound again. Only valid alongside a tag.
    renotify: !!data.tag,
    icon: '/icon-192.png',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target = new URL('/', self.location.origin)
  try {
    const u = new URL(event.notification.data?.url || '/', self.location.origin)
    if (u.origin === self.location.origin) target = u
  } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of windows) {
      await w.focus()
      try { await w.navigate(target.href) } catch {}
      return
    }
    await self.clients.openWindow(target.href)
  })())
})
