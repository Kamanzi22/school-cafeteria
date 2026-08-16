import { useNavigate } from 'react-router-dom'

// Always navigates to a fixed destination instead of navigate(-1) — going by
// actual browser history position turned out to be unreliable across repeated
// push/back cycles within the SPA (worked once, then silently no-op'd).
export function useBackNavigate(fallback = '/') {
  const navigate = useNavigate()
  return () => navigate(fallback)
}
