// Runs after `vite build` (see package.json "postbuild") and writes dist/sitemap.xml.
// Generated at build/deploy time rather than committed statically, since the restaurant list
// changes independently of the client's source code — a static file would drift stale within
// days. Never fails the build: if the API is unreachable (e.g. a local build with no backend
// running), it just falls back to the static routes below.
const SITE_URL = 'https://cafecampus-client.onrender.com'
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5000'

const STATIC_ROUTES = ['/', '/search']

async function fetchRestaurantSlugs() {
  try {
    const res = await fetch(`${API_URL}/api/restaurants`)
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    const { data } = await res.json()
    return (data || []).map(r => r.slug || r.id)
  } catch (e) {
    console.warn(`[sitemap] Could not fetch restaurants (${e.message}) — sitemap will only include static routes.`)
    return []
  }
}

function buildXml(paths) {
  const urls = paths.map(p => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const slugs = await fetchRestaurantSlugs()
const paths = [...STATIC_ROUTES, ...slugs.map(s => `/restaurant/${s}`)]
const fs = await import('node:fs/promises')
await fs.mkdir('dist', { recursive: true })
await fs.writeFile('dist/sitemap.xml', buildXml(paths))
console.log(`[sitemap] Wrote dist/sitemap.xml with ${paths.length} URLs.`)
