import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { portalHistory } from './portal'
import './index.css'
import './services/install'

// A tab left open across a deploy still references the previous build's lazily loaded page
// chunks (see App.jsx), which the new deploy no longer serves — reload onto the new build
// instead of failing. The timestamp guard stops a reload loop if a chunk is genuinely broken.
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try { last = Number(sessionStorage.getItem('chunkReloadAt')) || 0 } catch {}
  if (Date.now() - last < 10000) return
  try { sessionStorage.setItem('chunkReloadAt', String(Date.now())) } catch {}
  event.preventDefault()
  window.location.reload()
})

// On restaurant./superadmin. subdomains the router reads and writes short addresses (see portal.js)
const Router = ({ children }) => portalHistory
  ? <HistoryRouter history={portalHistory}>{children}</HistoryRouter>
  : <BrowserRouter>{children}</BrowserRouter>

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router>
        <App />
        <Toaster position="top-center" toastOptions={{ style:{ fontFamily:'DM Sans', borderRadius:'14px', fontSize:'14px', fontWeight:500 }, success:{ iconTheme:{ primary:'#ff5c1a', secondary:'white' } } }} />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
)
