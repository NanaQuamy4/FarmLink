import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'

const ICONS = {
  application_new: 'bi-person-plus', application_accepted: 'bi-check2-circle', application_declined: 'bi-x-circle',
  message: 'bi-chat-dots', plot_verified: 'bi-patch-check', plot_rejected: 'bi-patch-exclamation', plot_to_verify: 'bi-geo-alt',
  agreement_proposed: 'bi-file-earmark-text', agreement_confirmed: 'bi-file-earmark-check', milestone: 'bi-flag',
  harvest_recorded: 'bi-basket', deal_completed: 'bi-trophy', dispute_opened: 'bi-shield-exclamation', dispute_assigned: 'bi-shield-check',
  dispute_updated: 'bi-shield', offer_new: 'bi-tag', offer_accepted: 'bi-bag-check', offer_declined: 'bi-bag-x',
  verifier_request: 'bi-person-badge', verifier_approved: 'bi-person-check',
  support_ticket: 'bi-headset', support_reply: 'bi-headset', support_closed: 'bi-check2-circle',
  session_registered: 'bi-calendar-check', session_update: 'bi-camera-video', question_answered: 'bi-chat-square-quote', host_approved: 'bi-mic',
}
export const notificationIcon = (type) => ICONS[type] || 'bi-bell'

// Bell with unread count. New notifications arrive live through Supabase Realtime.
export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = items.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!user) return undefined
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(15)
      .then(({ data }) => setItems(data || []))
    const channel = supabase.channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new, ...prev].slice(0, 15)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function openItem(n) {
    setOpen(false)
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    }
    if (n.link) navigate(n.link)
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    await supabase.rpc('mark_all_notifications_read')
  }

  return (
    <div className="position-relative" ref={ref}>
      <button type="button" className="btn btn-light rounded-circle position-relative p-0 fl-icon-btn" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <i className="bi bi-bell fs-5" />
        {unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger fl-badge-pop">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="fl-dropdown shadow-lg" role="dialog" aria-label="Notifications">
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="btn btn-link btn-sm p-0" onClick={markAll}>Mark all read</button>}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 && <div className="text-center text-muted-fl small py-4">Nothing yet</div>}
            {items.map((n) => (
              <button key={n.id} type="button" onClick={() => openItem(n)} className={`fl-notif d-flex gap-2 w-100 text-start border-0 px-3 py-2 ${n.read_at ? '' : 'unread'}`}>
                <span className="fl-icon-tile soft flex-none" style={{ width: 34, height: 34, fontSize: '.95rem' }}><i className={`bi ${notificationIcon(n.type)}`} /></span>
                <span className="flex-grow-1 min-w-0">
                  <span className="d-block fw-semibold small">{n.title}</span>
                  {n.body && <span className="d-block small text-muted-fl text-truncate">{n.body}</span>}
                  <span className="d-block small text-muted-fl">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="fl-unread-dot mt-2" aria-label="unread" />}
              </button>
            ))}
          </div>
          <Link to="/notifications" className="d-block text-center small py-2 border-top" onClick={() => setOpen(false)}>See all</Link>
        </div>
      )}
    </div>
  )
}
