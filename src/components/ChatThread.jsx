import { useEffect, useRef, useState } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Avatar } from './ui'
import { fmtDateTime, displayName } from '../lib/format'

const SENDER = 'sender:profiles!messages_sender_id_fkey(id, full_name, is_group, group_name, avatar_url)'

// FR5: one-to-one chat for an application/deal (or a group chat when groupId is given).
// New messages arrive through Supabase Realtime; RLS makes sure only thread members receive them.
export default function ChatThread({ applicationId, groupId, canSend = true, height = 460, placeholder = 'Write a message…' }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)
  const key = applicationId ? 'application_id' : 'group_id'
  const threadId = applicationId || groupId

  useEffect(() => {
    let live = true
    setLoading(true)
    supabase.from('messages').select(`*, ${SENDER}`).eq(key, threadId).eq('is_notice', false).order('created_at').limit(300)
      .then(({ data, error: e }) => {
        if (!live) return
        if (e) setError(errorMessage(e))
        setMessages(data || [])
        setLoading(false)
      })
    if (applicationId) supabase.rpc('mark_thread_read', { p_application: applicationId })

    const channel = supabase.channel(`chat:${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `${key}=eq.${threadId}` }, async (payload) => {
        if (payload.new.is_notice) return
        const { data } = await supabase.from('messages').select(`*, ${SENDER}`).eq('id', payload.new.id).single()
        if (!live || !data) return
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
        if (applicationId && data.sender_id !== profile.id) supabase.rpc('mark_thread_read', { p_application: applicationId })
      })
      .subscribe()
    return () => { live = false; supabase.removeChannel(channel) }
  }, [threadId, key, applicationId, profile.id])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setError('')
    const { data, error: err } = await supabase.from('messages').insert({ [key]: threadId, sender_id: profile.id, body }).select(`*, ${SENDER}`).single()
    if (err) {
      setError(errorMessage(err))
      setText(body)
      return
    }
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
  }

  let lastDay = ''
  return (
    <div className="d-flex flex-column fl-chat" style={{ height }}>
      <div ref={listRef} className="flex-grow-1 overflow-auto p-3 d-grid gap-2 align-content-start" aria-live="polite">
        {loading && <div className="text-center small text-muted-fl py-4">Loading messages…</div>}
        {!loading && messages.length === 0 && <div className="text-center small text-muted-fl py-4"><i className="bi bi-chat-dots d-block fs-3 mb-1" />No messages yet. Say hello.</div>}
        {messages.map((m) => {
          const mine = m.sender_id === profile.id
          const day = new Date(m.created_at).toDateString()
          const showDay = day !== lastDay
          lastDay = day
          return (
            <div key={m.id}>
              {showDay && <div className="text-center small text-muted-fl my-2">{new Date(m.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
              <div className={`d-flex gap-2 align-items-end ${mine ? 'flex-row-reverse' : ''}`}>
                {!mine && <Avatar profile={m.sender} size={28} />}
                <div className={`fl-bubble ${mine ? 'me' : 'them'} fl-swap`}>
                  {groupId && !mine && <strong className="d-block small">{displayName(m.sender)}</strong>}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
                  <span className="d-block text-end" style={{ fontSize: '.68rem', opacity: 0.65 }}>
                    {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {mine && applicationId && <i className={`bi ${m.read_at ? 'bi-check2-all' : 'bi-check2'} ms-1`} title={m.read_at ? `Read ${fmtDateTime(m.read_at)}` : 'Sent'} />}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {error && <div className="alert alert-danger py-1 px-2 small m-2 mb-0">{error}</div>}
      {canSend ? (
        <form onSubmit={send} className="d-flex gap-2 p-2 border-top bg-white">
          <label htmlFor={`msg-${threadId}`} className="visually-hidden">Message</label>
          <textarea id={`msg-${threadId}`} className="form-control" rows={1} placeholder={placeholder} value={text} maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }} style={{ resize: 'none' }} />
          <button className="btn btn-primary rounded-circle p-0 flex-none" style={{ width: 44, height: 44 }} aria-label="Send" disabled={!text.trim()}><i className="bi bi-send-fill" /></button>
        </form>
      ) : (
        <div className="p-3 border-top small text-muted-fl text-center bg-white">This conversation is closed.</div>
      )}
    </div>
  )
}
