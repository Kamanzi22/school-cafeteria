import { useEffect, useRef } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
// hl=en + the button's `locale` keep Google's own text in English instead of following the
// browser language; the app itself is English-only.
const GSI_SRC = 'https://accounts.google.com/gsi/client?hl=en'

let gsiPromise
const loadGsi = () => {
  if (window.google?.accounts?.id) return Promise.resolve()
  gsiPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC; s.async = true; s.defer = true
    s.onload = resolve
    s.onerror = () => { gsiPromise = null; reject(new Error('Could not load Google sign-in')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}

// Google's own "Continue with Google" button. Google verifies the person's email, so the
// parent just receives a signed ID token (`credential`) to send to the server. Renders nothing
// when VITE_GOOGLE_CLIENT_ID isn't set.
export default function GoogleSignInButton({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGsi().then(() => {
      if (cancelled || !ref.current) return
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => cb.current(r.credential) })
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text, locale: 'en',
        width: Math.min(400, Math.floor(ref.current.offsetWidth)) || 300,
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [text])

  if (!CLIENT_ID) return null
  return <div ref={ref} className="w-full flex justify-center min-h-[44px]" />
}
