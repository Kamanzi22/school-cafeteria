import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Send, Loader, Mail, Phone, RefreshCw } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { superAdminAPI } from '../../services/api'
import { useSocket, getSocket } from '../../hooks/useSocket'
import toast from 'react-hot-toast'

const getStoredSuperAdminToken = () => {
  try { return JSON.parse(localStorage.getItem('cc-superadmin-v1') || '{}')?.state?.token || null } catch { return null }
}

const fmtTime = (d) => format(new Date(d), isToday(new Date(d)) ? 'HH:mm' : 'd MMM, HH:mm')

// A conversation is one customer's or one restaurant's — keyed "customer:<id>" / "restaurant:<id>"
const keyOf = (kind, id) => `${kind}:${id}`
const messageKey = (m) => m.restaurantId ? keyOf('restaurant', m.restaurantId) : keyOf('customer', m.customerId)

const KIND_BADGE = {
  customer: { label: 'Customer', cls: 'bg-ink-100 text-ink-500' },
  restaurant: { label: 'Restaurant', cls: 'bg-blue-100 text-blue-700' },
}

// Super admin inbox for the help chat — customers (Profile → "Message us") and restaurants
// (Settings → "Message us"). Conversation list on the left, the selected conversation on the
// right; on a phone only one of the two shows at a time. New messages arrive live on the
// 'superadmin' room.
export default function MessagesPage() {
  const navigate = useNavigate()
  const [token] = useState(getStoredSuperAdminToken)
  const [conversations, setConversations] = useState(null)
  const [selected, setSelected] = useState(null) // { kind, id }
  const [thread, setThread] = useState(null) // { kind, who, messages }
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const selectedKey = selected && keyOf(selected.kind, selected.id)
  const selectedKeyRef = useRef(null); selectedKeyRef.current = selectedKey
  const conversationsRef = useRef(null); conversationsRef.current = conversations

  const loadConversations = () => superAdminAPI.getConversations()
    .then(r => setConversations(r.data.data))
    .catch(e => {
      if (e.response?.status === 401 || e.response?.status === 403) { localStorage.removeItem('cc-superadmin-v1'); navigate('/superadmin') }
      else setConversations(c => c || [])
    })

  const openConversation = (kind, id) => {
    const key = keyOf(kind, id)
    setSelected({ kind, id })
    setThread(null)
    setDraft('')
    superAdminAPI.getConversation(kind, id).then(r => {
      if (selectedKeyRef.current !== key) return
      setThread(r.data.data)
      // Opening it marked their messages as read
      setConversations(prev => prev?.map(c => keyOf(c.kind, c.who.id) === key ? { ...c, unread: 0 } : c))
    }).catch(() => toast.error('Could not load conversation'))
  }

  useEffect(() => {
    if (!token) { navigate('/superadmin'); return }
    getSocket().emit('join:superadmin', { token })
    loadConversations()
  }, [token])

  // Rooms don't survive a reconnect
  useSocket({
    connect: () => { if (token) getSocket().emit('join:superadmin', { token }) },
    'support:message': (msg) => {
      // Admin replies go to the customer's/restaurant's room — only here if that app is signed in on this browser too
      if (msg.fromAdmin) return
      const key = messageKey(msg)
      // First message in this conversation — fetch the list to get the sender's details
      if (conversationsRef.current && !conversationsRef.current.some(c => keyOf(c.kind, c.who.id) === key)) loadConversations()
      const isOpen = selectedKeyRef.current === key
      if (isOpen) {
        setThread(t => t && !t.messages.some(m => m.id === msg.id) ? { ...t, messages: [...t.messages, msg] } : t)
        // Being read right now — re-fetch so the server marks it read
        const [kind, id] = key.split(':')
        superAdminAPI.getConversation(kind, id).catch(() => {})
      } else {
        toast(`New message from ${msg.senderName || 'a customer'}`, { id: `support-${msg.id}`, icon: '💬' })
      }
      setConversations(prev => {
        const existing = prev?.find(c => keyOf(c.kind, c.who.id) === key)
        if (!existing) return prev
        const updated = { ...existing, lastMessage: msg, unread: isOpen ? 0 : existing.unread + 1 }
        return [updated, ...prev.filter(c => c !== existing)]
      })
    },
  })

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [thread?.messages.length, thread?.who.id])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending || !selected) return
    setSending(true)
    try {
      const res = await superAdminAPI.reply(selected.kind, selected.id, body)
      const msg = res.data.data
      setThread(t => t ? { ...t, messages: [...t.messages, msg] } : t)
      setConversations(prev => {
        const existing = prev?.find(c => keyOf(c.kind, c.who.id) === selectedKey)
        return existing ? [{ ...existing, lastMessage: msg }, ...prev.filter(c => c !== existing)] : prev
      })
      setDraft('')
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send reply') }
    finally { setSending(false) }
  }

  const totalUnread = conversations?.reduce((n, c) => n + c.unread, 0) || 0

  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="gradient-dark text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/superadmin" className="btn btn-ghost btn-icon text-ink-400"><ArrowLeft size={18} /></Link>
            <div>
              <p className="font-black text-lg flex items-center gap-2"><MessageCircle size={18} /> Messages</p>
              <p className="text-ink-400 text-xs">{totalUnread > 0 ? `${totalUnread} unread` : 'Help chat with customers and restaurants'}</p>
            </div>
          </div>
          <button onClick={loadConversations} className="btn btn-ghost text-ink-400 text-sm"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden md:grid md:grid-cols-[280px_1fr] md:h-[calc(100dvh-10rem)] md:min-h-[480px]">
          {/* Conversation list */}
          <div className={`${selected ? 'hidden md:block' : ''} md:border-r border-ink-100 md:overflow-y-auto`}>
            {conversations === null ? (
              <div className="p-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-400">No messages yet. Customers can write to you from their profile page, and restaurants from their Settings page.</div>
            ) : conversations.map(c => {
              const key = keyOf(c.kind, c.who.id)
              return (
                <button key={key} onClick={() => openConversation(c.kind, c.who.id)}
                  className={`w-full text-left px-4 py-3 border-b border-ink-50 hover:bg-ink-50 flex items-start gap-3 ${selectedKey === key ? 'bg-ink-50' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${c.kind === 'restaurant' ? 'bg-blue-50 text-lg' : 'bg-brand-100 text-brand-700'}`}>
                    {c.kind === 'restaurant' ? (c.who.emoji || '🍽️') : (c.who.name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${c.unread ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`}>{c.who.name}</p>
                      <span className="text-[11px] text-ink-400 shrink-0">{fmtTime(c.lastMessage.createdAt)}</span>
                    </div>
                    <span className={`badge ${KIND_BADGE[c.kind].cls} text-[10px] mt-0.5`}>{KIND_BADGE[c.kind].label}</span>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${c.unread ? 'text-ink-700' : 'text-ink-400'}`}>
                        {c.lastMessage.fromAdmin && 'You: '}{c.lastMessage.body}
                      </p>
                      {c.unread > 0 && <span className="badge bg-brand-500 text-white text-[10px] px-1.5 shrink-0">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected conversation */}
          <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-col min-h-0 h-[calc(100dvh-10rem)] md:h-auto`}>
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-ink-400 p-8">Select a conversation</div>
            ) : !thread ? (
              <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-brand-500" /></div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-3">
                  <button onClick={() => { setSelected(null); setThread(null) }} className="btn btn-icon text-ink-400 hover:bg-ink-100 md:hidden"><ArrowLeft size={16} /></button>
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900 truncate">
                      {thread.kind === 'restaurant' && `${thread.who.emoji || '🍽️'} `}{thread.who.name}
                      <span className={`badge ${KIND_BADGE[thread.kind].cls} ml-2 align-middle`}>{KIND_BADGE[thread.kind].label}</span>
                      {thread.who.accountType === 'guest' && <span className="badge bg-amber-100 text-amber-700 ml-1 align-middle">Guest</span>}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-ink-400">
                      {thread.who.ownerName && <span>Owner: {thread.who.ownerName}</span>}
                      {thread.who.email && <a href={`mailto:${thread.who.email}`} className="flex items-center gap-1 hover:text-ink-700"><Mail size={11} />{thread.who.email}</a>}
                      {thread.who.phone && <a href={`tel:${thread.who.phone}`} className="flex items-center gap-1 hover:text-ink-700"><Phone size={11} />{thread.who.phone}</a>}
                    </div>
                  </div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50/50">
                  {thread.messages.map(m => (
                    <div key={m.id} className={`flex ${m.fromAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.fromAdmin ? 'bg-brand-500 text-white rounded-br-md' : 'bg-white border border-ink-100 text-ink-900 rounded-bl-md'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 text-right ${m.fromAdmin ? 'text-white/70' : 'text-ink-400'}`}>
                          {fmtTime(m.createdAt)}{m.fromAdmin && m.readAt && ' · Seen'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={send} className="p-3 border-t border-ink-100 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }}
                    placeholder={`Reply to ${thread.who.name}…`}
                    rows={2}
                    maxLength={2000}
                    className="flex-1 resize-none bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                  <button type="submit" disabled={!draft.trim() || sending} className="btn btn-primary btn-icon h-11 w-11 shrink-0" aria-label="Send reply">
                    {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
