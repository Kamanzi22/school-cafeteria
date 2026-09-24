import { useEffect } from 'react'

// An installed PWA that's reopened from the home screen is usually just resumed from the
// background, not freshly navigated to — so it never re-fetches index.html and keeps running
// whatever build was loaded when it was last actually launched, even long after a new version
// has shipped. Vite hashes each build's script filename by content, so comparing the one this
// tab loaded against the one the live HTML currently references is a reliable "is a newer
// build out" check, with no separate version file to keep in sync. `location.pathname` works
// for every app shell (customer/admin/superadmin) because Render's static routing rewrites it
// to the matching HTML file server-side (see render.yaml).
export function useAppUpdateCheck() {
  useEffect(() => {
    const currentSrc = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src')
    if (!currentSrc) return

    const check = async () => {
      try {
        const res = await fetch(window.location.pathname, { cache: 'no-store' })
        const html = await res.text()
        const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)
        if (match && match[1] !== currentSrc) window.location.reload()
      } catch {}
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') check() }, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])
}
