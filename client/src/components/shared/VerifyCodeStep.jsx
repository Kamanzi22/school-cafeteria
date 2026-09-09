import { useState } from 'react'
import { Loader, ShieldCheck } from 'lucide-react'

// Shared "enter the 6-digit code we emailed you" step, reused by customer signup and by a
// restaurant owner changing their login email or password. `email` is just for the copy —
// confirming always happens through `onConfirm(code)`, so a code pasted in from the email's
// "Verify Email" link (which prefills `initialCode`) works exactly like typing it.
export default function VerifyCodeStep({ email, onConfirm, onBack, onResend, initialCode = '' }) {
  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try { await onConfirm(code) }
    finally { setLoading(false) }
  }

  const resend = async () => {
    setResending(true)
    try { await onResend() }
    finally { setResending(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-sm text-brand-700 flex items-start gap-2">
        <ShieldCheck size={16} className="shrink-0 mt-0.5" />
        <span>We sent a 6-digit code to <strong>{email}</strong>. Enter it below, or use the link in the email.</span>
      </div>
      <input
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoFocus
        className="input text-center text-2xl font-bold tracking-[0.5em]"
        placeholder="000000"
        required
      />
      <button type="submit" disabled={loading || code.length !== 6} className="btn btn-primary w-full btn-lg">
        {loading ? <Loader size={16} className="animate-spin" /> : null}
        {loading ? 'Verifying…' : 'Verify'}
      </button>
      <div className="flex items-center justify-between text-xs pt-1">
        <button type="button" onClick={onBack} className="text-ink-400 hover:underline">← Back</button>
        {onResend && (
          <button type="button" onClick={resend} disabled={resending} className="text-brand-500 hover:underline disabled:opacity-50">
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </form>
  )
}
