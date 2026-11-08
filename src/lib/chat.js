import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// Shared chat behaviour for deal chats, group chats and support threads (WhatsApp-style).

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }

// "Today", "Yesterday", weekday for the last week, then the full date
export function dayLabel(d) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(d)) / 864e5)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return new Date(d).toLocaleDateString('en-GB', { weekday: 'long' })
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: diff > 300 ? 'numeric' : undefined })
}

export const timeOf = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Same sender, same day, within 5 minutes: shown as one run (name and photo once)
export function sameRun(a, b) {
  if (!a || !b || a.sender_id !== b.sender_id) return false
  if (startOfDay(a.created_at) !== startOfDay(b.created_at)) return false
  return Math.abs(new Date(b.created_at) - new Date(a.created_at)) < 5 * 60000
}

// A steady, readable colour per person for names in group chats
const NAME_COLORS = ['#05402E', '#9A3412', '#1D4ED8', '#7E22CE', '#B45309', '#0F766E', '#BE185D', '#4D7C0F', '#6D28D9', '#C2410C']
export function nameColor(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

// Who else is in this chat right now, and who is typing (Supabase Realtime presence + broadcast;
// nothing is stored in the database).
export function useChatPresence(key, me) {
  const [online, setOnline] = useState([])
  const [typing, setTyping] = useState({})
  const channelRef = useRef(null)
  const lastSent = useRef(0)

  useEffect(() => {
    if (!key || !me?.id) return undefined
    const ch = supabase.channel(`presence:${key}`, { config: { presence: { key: me.id }, broadcast: { self: false } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      setOnline(Object.entries(state).filter(([id]) => id !== me.id).map(([id, metas]) => ({ id, name: metas[0]?.name })))
    })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload?.id || payload.id === me.id) return
      setTyping((t) => ({ ...t, [payload.id]: { name: payload.name, until: Date.now() + 3500 } }))
    })
    ch.on('broadcast', { event: 'stopped' }, ({ payload }) => {
      setTyping((t) => { const n = { ...t }; delete n[payload?.id]; return n })
    })
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ name: me.name, at: Date.now() }) })
    channelRef.current = ch
    const sweep = setInterval(() => setTyping((t) => {
      const now = Date.now()
      const n = Object.fromEntries(Object.entries(t).filter(([, v]) => v.until > now))
      return Object.keys(n).length === Object.keys(t).length ? t : n
    }), 1000)
    return () => { clearInterval(sweep); supabase.removeChannel(ch); channelRef.current = null }
  }, [key, me?.id, me?.name])

  // Call on every keystroke; sends at most every 2 seconds
  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (!channelRef.current || now - lastSent.current < 2000) return
    lastSent.current = now
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { id: me?.id, name: me?.name } })
  }, [me?.id, me?.name])

  const notifyStopped = useCallback(() => {
    lastSent.current = 0
    channelRef.current?.send({ type: 'broadcast', event: 'stopped', payload: { id: me?.id } })
  }, [me?.id])

  const typingNames = Object.values(typing).map((t) => t.name).filter(Boolean)
  return { online, typingNames, notifyTyping, notifyStopped }
}

export function typingText(names) {
  if (!names.length) return ''
  if (names.length === 1) return `${names[0].split(' ')[0]} is typing`
  if (names.length === 2) return `${names[0].split(' ')[0]} and ${names[1].split(' ')[0]} are typing`
  return `${names.length} people are typing`
}
