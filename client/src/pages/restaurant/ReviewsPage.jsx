import { useState, useEffect } from 'react'
import { Star, MessageSquare, Loader } from 'lucide-react'
import { restaurantAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState(null)
  const [reply, setReply] = useState('')
  const { restaurant } = useAdminStore()

  useEffect(() => {
    restaurantAPI.getReviews(restaurant.id).then(r => { setReviews(r.data.data); setLoading(false) })
  }, [restaurant.id])

  const submitReply = async (id) => {
    try {
      await restaurantAPI.replyReview(id, reply)
      setReviews(prev => prev.map(r => r.id === id ? { ...r, reply, repliedAt: new Date().toISOString() } : r))
      setReplyId(null)
      setReply('')
      toast.success('Reply sent!')
    } catch { toast.error('Failed') }
  }

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length).toFixed(1) : null

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-ink-900">Reviews</h1>
          {avg && <p className="text-ink-400 text-sm">Average: <span className="font-bold text-amber-500">{'⭐'.repeat(Math.round(avg))} {avg}/5</span> from {reviews.length} reviews</p>}
        </div>

        {loading ? <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        : reviews.length === 0 ? (
          <div className="text-center py-20"><Star size={40} className="text-ink-200 mx-auto mb-3" /><p className="text-ink-400 font-semibold">No reviews yet</p></div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full gradient-flame flex items-center justify-center text-white font-bold shrink-0">
                    {r.student?.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-900 text-sm">{r.student?.name}</span>
                      <span className="text-xs text-ink-400">{format(new Date(r.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-500 mt-0.5">
                      <span>Food: {'⭐'.repeat(r.foodRating)}</span>
                      <span>Service: {'⭐'.repeat(r.serviceRating)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-ink-700 mt-2 leading-relaxed">{r.comment}</p>}
                  </div>
                </div>

                {/* Existing reply */}
                {r.reply && (
                  <div className="ml-13 mt-3 bg-flame-50 border border-flame-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-flame-600 mb-1">Your reply</p>
                    <p className="text-sm text-ink-700">{r.reply}</p>
                  </div>
                )}

                {/* Reply input */}
                {replyId === r.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea value={reply} onChange={e => setReply(e.target.value)} className="input resize-none h-20 text-sm" placeholder="Write a reply…" />
                    <div className="flex gap-2">
                      <button onClick={() => setReplyId(null)} className="btn btn-secondary btn-sm flex-1">Cancel</button>
                      <button onClick={() => submitReply(r.id)} disabled={!reply} className="btn btn-primary btn-sm flex-1">Send Reply</button>
                    </div>
                  </div>
                ) : !r.reply && (
                  <button onClick={() => { setReplyId(r.id); setReply('') }} className="mt-3 btn btn-ghost btn-sm text-flame-500">
                    <MessageSquare size={14} />Reply
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
