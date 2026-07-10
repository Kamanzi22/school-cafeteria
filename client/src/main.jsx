import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" toastOptions={{ style:{ fontFamily:'DM Sans', borderRadius:'14px', fontSize:'14px', fontWeight:500 }, success:{ iconTheme:{ primary:'#ff5c1a', secondary:'white' } } }} />
    </BrowserRouter>
  </React.StrictMode>
)
