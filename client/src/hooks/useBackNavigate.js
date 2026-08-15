import { useNavigate } from 'react-router-dom'

// navigate(-1) does nothing when the page was opened directly (no in-app
// history entry to go back to) — fall back to home in that case.
export function useBackNavigate(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    // TEMPORARY diagnostic — remove once the Back-button issue is confirmed fixed.
    alert('Back button clicked. history.state=' + JSON.stringify(window.history.state))
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(fallback)
  }
}
