import { useEffect, useRef, useState } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Avatar } from './ui'
import { fmtDateTime, displayName } from '../lib/format'
import { dayLabel, timeOf, sameRun, nameColor, useChatPresence, typingText } from '../lib/chat'

const SENDER = 'sender:profiles!messages_sender_id_fkey(id, full_name, is_group, group_name, avatar_url)'

// FR5: one-to-one chat for an application/deal (or a group chat when groupId is given).
// New messages arrive through Supabase Realtime; RLS makes sure only thread members receive them.
// WhatsApp-style: Today/Yesterday dividers, runs of messages grouped under one name, coloured
// names in groups, read ticks, a "new messages" marker, online status and a typing indicator.
export default function ChatThread({ applicationId, groupId, canSend = true, height = 460, placeholder = 'Write a message…', showNames = false }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [firstUnread, setFirstUnread] = useState(null)
  const listRef = useRef(null)
  const key = applicationId ? 'application_id' : 'group_id'
  const threadId = applicationId || groupId
  const isGroup = Boolean(groupId)
  const named = isGroup || showNames // names and photos on bubbles (groups, or verifiers reading a deal chat)
  const { online, typingNames, notifyTyping, notifyStopped } = useChatPresence(threadId, { id: profile.id, name: displayName(profile) })

  useEffect(() => {
    let live = true
    setLoading(true)
    setFirstUnread(null)
    supabase.from('messages').select(`*, ${SENDER}`).eq(key, threadId).eq('is_notice', false).order('created_at').limit(300)
      .then(({ data, error: e }) => {
        if (!live) return
        if (e) setError(errorMessage(e))
        const rows = data || []
        setMessages(rows)
        // Where "New messages" starts (one-to-one chats keep read receipts)
        if (applicationId) setFirstUnread(rows.find((m) => m.sender_id !== profile.id && !m.read_at)?.id || null)
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `${key}=eq.${threadId}` }, (payload) => {
        // read receipts: the other person opened the chat
        if (live) setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m)))
      })
      .subscribe()
    return () => { live = false; supabase.removeChannel(channel) }
  }, [threadId, key, applicationId, profile.id])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typingNames.length])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setError('')
    notifyStopped()
    const { data, error: err } = await supabase.from('messages').insert({ [key]: threadId, sender_id: profile.id, body }).select(`*, ${SENDER}`).single()
    if (err) {
      setError(errorMessage(err))
      setText(body)
      return
    }
    setFirstUnread(null)
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
  }

  // Status line: who is online, or who is typing
  const status = typingNames.length
    ? <span className="fl-typing-text">{typingText(typingNames)}<span className="fl-typing"><span /><span /><span /></span></span>
    : online.length
      ? <span><span className="fl-online-dot" />{isGroup ? `${online.length} online` : 'Online'}</span>
      : null

  return (
    <div className="d-flex flex-column fl-chat" style={{ height }}>
      {status && <div className="fl-chat-status small px-3 py-1">{status}</div>}
      <div ref={listRef} className="flex-grow-1 overflow-auto px-3 py-2" aria-live="polite">
        {loading && <div className="text-center small text-muted-fl py-4">Loading messages…</div>}
        {!loading && messages.length === 0 && <div className="text-center small text-muted-fl py-4"><i className="bi bi-chat-dots d-block fs-3 mb-1" />No messages yet. Say hello.</div>}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const mine = m.sender_id === profile.id
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
          const startsRun = newDay || !sameRun(prev, m) || m.id === firstUnread
          const endsRun = !next || !sameRun(m, next) || next.id === firstUnread || dayLabel(next.created_at) !== dayLabel(m.created_at)
          return (
            <div key={m.id}>
              {newDay && <div className="fl-chat-day"><span>{dayLabel(m.created_at)}</span></div>}
              {m.id === firstUnread && <div className="fl-chat-unread"><span>New messages</span></div>}
              <div className={`d-flex gap-2 align-items-end ${mine ? 'flex-row-reverse' : ''} ${startsRun ? 'mt-2' : 'mt-1'}`}>
                {!mine && named && (endsRun ? <Avatar profile={m.sender} size={28} /> : <span className="flex-none" style={{ width: 28 }} />)}
                <div className={`fl-bubble ${mine ? 'me' : 'them'} ${startsRun ? 'first' : ''} ${endsRun ? 'last' : ''} fl-swap`}>
                  {named && !mine && startsRun && <strong className="d-block small" style={{ color: nameColor(m.sender_id) }}>{displayName(m.sender)}</strong>}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
                  <span className="fl-bubble-meta" title={fmtDateTime(m.created_at)}>
                    {timeOf(m.created_at)}
                    {mine && applicationId && <i className={`bi ${m.read_at ? 'bi-check2-all fl-read' : 'bi-check2'} ms-1`} aria-label={m.read_at ? `Read ${fmtDateTime(m.read_at)}` : 'Sent'} />}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        {typingNames.length > 0 && (
          <div className="d-flex mt-2"><div className="fl-bubble them first last"><span className="fl-typing"><span /><span /><span /></span></div></div>
        )}
      </div>
      {error && <div className="alert alert-danger py-1 px-2 small m-2 mb-0">{error}</div>}
      {canSend ? (
        <form onSubmit={send} className="d-flex gap-2 p-2 border-top bg-white">
          <label htmlFor={`msg-${threadId}`} className="visually-hidden">Message</label>
          <textarea id={`msg-${threadId}`} className="form-control" rows={1} placeholder={placeholder} value={text} maxLength={4000}
            onChange={(e) => { setText(e.target.value); if (e.target.value) notifyTyping(); else notifyStopped() }}
            onBlur={notifyStopped}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }} style={{ resize: 'none' }} />
          <button className="btn btn-primary rounded-circle p-0 flex-none" style={{ width: 44, height: 44 }} aria-label="Send" disabled={!text.trim()}><i className="bi bi-send-fill" /></button>
        </form>
      ) : (
        <div className="p-3 border-top small text-muted-fl text-center bg-white">This conversation is closed.</div>
      )}
    </div>
  )
}
