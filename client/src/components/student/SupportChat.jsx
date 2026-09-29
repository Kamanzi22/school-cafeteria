import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, Loader } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { customerAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import { useCustomerStore } from '../../store'
import toast from 'react-hot-toast'

const MAX_LENGTH = 2000
const fmtTime = (d) => format(new Date(d), isToday(new Date(d)) ? 'HH:mm' : 'd MMM, HH:mm')

// "Message us" card on the profile page — the customer's one conversation with the super admin.
// The admin's replies arrive live on the customer's socket room (joined app-wide by
// useOrderNotifications) and as a push notification that links back here (/profile#messages).
export default function SupportChat() {
  const customer = useCustomerStore(s => s.customer)
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const cardRef = useRef(null)

  const load = () => customerAPI.getMessages(customer.id).then(res => setMessages(res.data.data)).catch(() => setMessages(m => m || []))

  useEffect(() => { if (customer?.id) load() }, [customer?.id])

  // Arrived from the "support replied" notification
  useEffect(() => {
    if (window.location.hash === '#messages') cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Replies may have come in while the app was in the background (socket dropped)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && customer?.id) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [customer?.id])

  useSocket({
    'support:message': (msg) => {
      // The same socket also carries the super admin room when that app is signed in on this
      // browser, so only take this customer's replies from the admin
      if (!msg.fromAdmin || msg.customerId !== customer?.id) return
      setMessages(prev => prev && !prev.some(m => m.id === msg.id) ? [...prev, msg] : prev)
      // They're looking at the conversation, so the reply counts as read
      if (document.visibilityState === 'visible') customerAPI.getMessages(msg.customerId).catch(() => {})
    },
  })

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages?.length])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await customerAPI.sendMessage(customer.id, body)
      setMessages(prev => [...(prev || []), res.data.data])
      setDraft('')
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send your message') }
    finally { setSending(false) }
  }

  if (!customer) return null

  return (
    <div id="messages" ref={cardRef} className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="text-alu-muted mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-alu-cream text-sm">Message us</p>
          <p className="text-xs text-alu-muted mt-0.5">Write to the CaféCampus team — we'll reply here.</p>
        </div>
      </div>

      {messages === null ? (
        <div className="py-6 text-center"><Loader size={18} className="animate-spin text-alu-muted mx-auto" /></div>
      ) : messages.length > 0 && (
        <div ref={listRef} className="mt-4 max-h-80 overflow-y-auto space-y-2 pr-1">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.fromAdmin ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${m.fromAdmin ? 'bg-alu-card text-alu-cream rounded-bl-md' : 'bg-alu-red text-white rounded-br-md'}`}>
                {m.fromAdmin && <p className="text-[11px] font-semibold text-alu-muted mb-0.5">CaféCampus team</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 text-right ${m.fromAdmin ? 'text-alu-muted' : 'text-white/70'}`}>{fmtTime(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={send} className="mt-4 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }}
          placeholder="Type your message…"
          rows={2}
          maxLength={MAX_LENGTH}
          className="input resize-none flex-1"
        />
        <button type="submit" disabled={!draft.trim() || sending} className="btn btn-primary btn-icon h-11 w-11 shrink-0" aria-label="Send">
          {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  )
}
