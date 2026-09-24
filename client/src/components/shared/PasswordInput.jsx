import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// A password field with a show/hide toggle so it can be checked while typing. Drops in for a
// plain `<input type="password" className="input" />` — every prop besides className passes
// straight through to the input.
export default function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`input pr-10 ${className}`} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}
