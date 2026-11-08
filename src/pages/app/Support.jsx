import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useQuery } from '../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, ActionButton, Field, Avatar } from '../../components/ui'
import { fmtDateTime, timeAgo, displayName } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/constants'

export const CATEGORIES = {
  account: 'My account or login', plot: 'A plot listing', deal: 'A deal or agreement', verification: 'Verification',
  session: 'An education session', marketplace: 'Marketplace', bug: 'Something is not working', other: 'Something else',
}
const STATUS = { open: ['Waiting for support', 'pending'], answered: ['Support replied', 'verified'], closed: ['Closed', 'neutral'] }
const Status = ({ s }) => <span className={`fl-status ${STATUS[s][1]}`}>{STATUS[s][0]}</span>

const FAQ = [
  ['How long does verification take?', 'A verifier for your region is notified as soon as you list a plot. Most visits happen within a week. If your region has no verifier yet, an administrator checks it.'],
  ['Is my agreement a legal contract?', 'No. It is a record of what both of you confirmed on FarmLink, which a verifier uses if there is a dispute. For a legal contract, see a lawyer or the Lands Commission.'],
  ['Who can see my phone number?', 'Only your deal partner, the verifier assigned to your plot or deal, and administrators.'],
  ['How do I become a verifier or session host?', 'Verifiers request access from Profile & settings. Experts who want to host sessions can ask here and an administrator can switch it on.'],
  ['Does FarmLink handle money?', 'No. FarmLink records the harvest split and its value. Payment happens between you and the other party.'],
  ['Something went wrong in a deal', 'First try the chat. If you cannot agree, raise a dispute on the deal page so the verifier can mediate. Contact support if the problem is with the platform itself.'],
]

// Conversation inside one ticket, live for both sides
function Thread({ ticket, staffView, onChanged }) {
  const { profile } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const listRef = useRef(null)
  const SEL = '*, sender:profiles!support_messages_sender_id_fkey(id, full_name, is_group, group_name, avatar_url)'

  useEffect(() => {
    let live = true
    supabase.from('support_messages').select(SEL).eq('ticket_id', ticket.id).order('created_at').then(({ data }) => live && setMsgs(data || []))
    const ch = supabase.channel(`support:${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` }, async (p) => {
        const { data } = await supabase.from('support_messages').select(SEL).eq('id', p.new.id).single()
        if (live && data) setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
      })
      .subscribe()
    return () => { live = false; supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [msgs])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setErr('')
    const { data, error } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_id: profile.id, body }).select(SEL).single()
    if (error) return setErr(errorMessage(error))
    setText('')
    setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
    onChanged?.()
  }

  return (
    <section className="fl-card p-0 overflow-hidden h-auto">
      <div ref={listRef} className="fl-chat p-3 d-grid gap-3 align-content-start" style={{ maxHeight: '58vh', minHeight: 260, overflowY: 'auto' }} aria-live="polite">
        {msgs.map((m) => {
          const mine = m.sender_id === profile.id
          return (
            <div key={m.id} className={`d-flex gap-2 align-items-end ${mine ? 'flex-row-reverse' : ''}`}>
              {!mine && (m.is_staff ? <span className="fl-icon-tile flex-none" style={{ width: 30, height: 30, fontSize: '.9rem' }}><i className="bi bi-headset" /></span> : <Avatar profile={m.sender} size={30} />)}
              <div className={`fl-bubble ${mine ? 'me' : 'them'}`} style={{ maxWidth: '82%' }}>
                <strong className="d-block small">{m.is_staff ? `FarmLink support${staffView ? ` · ${m.sender?.full_name}` : ''}` : displayName(m.sender)}</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
                <span className="d-block text-end" style={{ fontSize: '.68rem', opacity: 0.65 }}>{fmtDateTime(m.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>
      {err && <div className="alert alert-danger py-1 px-2 small m-2 mb-0">{err}</div>}
      <form onSubmit={send} className="d-flex gap-2 p-2 border-top bg-white">
        <label htmlFor="support-reply" className="visually-hidden">Reply</label>
        <textarea id="support-reply" className="form-control" rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={staffView ? 'Reply to the user…' : ticket.status === 'closed' ? 'Write to reopen this request…' : 'Add more details…'} />
        <button className="btn btn-primary flex-none" disabled={!text.trim()}>{staffView ? 'Reply' : 'Send'}</button>
      </form>
    </section>
  )
}

function NewTicket({ onCreated }) {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const [f, setF] = useState({ category: params.get('category') || 'other', subject: '', body: '', related_link: params.get('about') || '' })
  const [err, setErr] = useState('')
  async function submit() {
    setErr('')
    if (f.subject.trim().length < 3 || !f.body.trim()) return setErr('Add a short subject and describe the problem.')
    const { data: t, error } = await supabase.from('support_tickets').insert({ user_id: profile.id, category: f.category, subject: f.subject.trim(), related_link: f.related_link || null }).select().single()
    if (error) return setErr(errorMessage(error))
    const m = await supabase.from('support_messages').insert({ ticket_id: t.id, sender_id: profile.id, body: f.body.trim() })
    if (m.error) return setErr(errorMessage(m.error))
    onCreated(t.id)
  }
  return (
    <section className="fl-card p-4 h-auto" id="contact">
      <h2 className="h5">Contact support</h2>
      <p className="small text-muted-fl">An administrator replies here and you get a notification. Do not share passwords.</p>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <div className="row g-3">
        <Field className="col-md-5" label="What is it about?" htmlFor="t-cat">
          <select id="t-cat" className="form-select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field className="col-md-7" label="Subject" htmlFor="t-sub"><input id="t-sub" className="form-control" maxLength={160} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. I cannot upload photos" /></Field>
        <Field className="col-12" label="Describe the problem" htmlFor="t-body" hint="What you were doing, what happened, and what you expected.">
          <textarea id="t-body" className="form-control" rows={4} maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Field>
        {f.related_link && <div className="col-12 small text-muted-fl"><i className="bi bi-link-45deg me-1" />About: <Link to={f.related_link}>{f.related_link}</Link></div>}
      </div>
      <ActionButton className="btn btn-primary mt-3" onClick={submit}><i className="bi bi-send me-1" />Send to support</ActionButton>
    </section>
  )
}

// Help centre for every user: quick answers, contact form, my requests
export function HelpCenter() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, loading, error, reload } = useQuery(() => supabase.from('support_tickets').select('*').eq('user_id', profile.id).order('last_message_at', { ascending: false }), [profile.id])

  useEffect(() => { if (params.get('new')) document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }, [params, loading])

  return (
    <div className="fl-page">
      <PageHeader image="/images/farmer-basket.webp" imagePosition="center 30%" eyebrow="Help & support" title="How can we" accent="help you?"
        text="Quick answers to common questions, or write to the FarmLink team."
        actions={<a href="#contact" className="btn btn-primary btn-lg"><i className="bi bi-chat-dots me-1" />Contact support</a>} />
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <section>
            <h2 className="h5 mb-3">Quick answers</h2>
            <div className="fl-faq">
              {FAQ.map(([q, a]) => (
                <details className="accordion-item bg-white" key={q}>
                  <summary className="accordion-button collapsed">{q}</summary>
                  <div className="accordion-body pt-0 text-muted-fl">{a}</div>
                </details>
              ))}
            </div>
          </section>
          <NewTicket onCreated={(id) => navigate(`/help/${id}`)} />
        </div>
        <div className="col-lg-5">
          <h2 className="h5 mb-3">Your requests</h2>
          <ErrorAlert error={error} onRetry={reload} />
          {loading ? <Loading /> : !data?.length ? (
            <div className="fl-card h-auto"><EmptyState icon="bi-headset" title="No requests yet" text="When you contact support, the conversation appears here." /></div>
          ) : (
            <div className="fl-card p-2 h-auto">
              {data.map((t) => (
                <Link key={t.id} to={`/help/${t.id}`} className="fl-list-item">
                  <span className="fl-icon-tile soft flex-none"><i className="bi bi-headset" /></span>
                  <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{t.subject}</div><div className="small text-muted-fl">{CATEGORIES[t.category]} · {timeAgo(t.last_message_at)}</div></div>
                  <Status s={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// One ticket, for the user who opened it or for an admin
export function TicketPage() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const staffView = role === 'admin'
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const { data: t, error: e } = await supabase.from('support_tickets').select('*, user:profiles!support_tickets_user_id_fkey(id, full_name, role, region, is_group, group_name, avatar_url)').eq('id', id).maybeSingle()
    if (e) throw e
    if (!t) throw new Error('Request not found.')
    return t
  }, [id])

  async function setStatus(status) {
    setErr('')
    const { error: e } = await supabase.rpc('set_ticket_status', { p_ticket: id, p_status: status })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const t = data
  return (
    <div className="fl-page" style={{ maxWidth: 1000 }}>
      <Link to={staffView ? '/admin/support' : '/help'} className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />{staffView ? 'Support requests' : 'Help & support'}</Link>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="small text-muted-fl">{CATEGORIES[t.category]} · opened {fmtDateTime(t.created_at)}</div>
          <h1 className="h3 mb-1">{t.subject}</h1>
          {t.related_link && <div className="small"><i className="bi bi-link-45deg me-1" />About <Link to={t.related_link}>{t.related_link}</Link></div>}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Status s={t.status} />
          {t.status !== 'closed'
            ? <ActionButton className="btn btn-sm btn-outline-primary" confirm={staffView ? 'Close this request?' : 'Mark your request as solved?'} onClick={() => setStatus('closed')}>{staffView ? 'Close' : 'Solved, close it'}</ActionButton>
            : <ActionButton className="btn btn-sm btn-outline-primary" onClick={() => setStatus('open')}>Reopen</ActionButton>}
        </div>
      </div>
      <ErrorAlert error={err} />
      <div className="row g-4">
        <div className={staffView ? 'col-lg-8' : 'col-12'}><Thread ticket={t} staffView={staffView} onChanged={reload} /></div>
        {staffView && (
          <div className="col-lg-4">
            <div className="fl-card p-4 h-auto">
              <div className="small text-muted-fl mb-2">From</div>
              <Link to={`/u/${t.user.id}`} className="d-flex align-items-center gap-2 text-reset text-decoration-none mb-2">
                <Avatar profile={t.user} size={40} /><div><div className="fw-semibold">{displayName(t.user)}</div><div className="small text-muted-fl">{ROLE_LABELS[t.user.role]}{t.user.region && ` · ${t.user.region}`}</div></div>
              </Link>
              <Link to="/admin/users" className="btn btn-sm btn-outline-primary w-100">Manage users</Link>
              {t.user_id === profile.id && <p className="small text-muted-fl mt-2 mb-0">You opened this request yourself.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Admin inbox
export function AdminSupport() {
  const [tab, setTab] = useState('open')
  const { data, loading, error, reload } = useQuery(() => supabase.from('support_tickets')
    .select('*, user:profiles!support_tickets_user_id_fkey(id, full_name, role, is_group, group_name, avatar_url)').order('last_message_at', { ascending: false }), [])
  const rows = (data || []).filter((t) => tab === 'all' || t.status === tab)
  const count = (s) => (data || []).filter((t) => t.status === s).length
  return (
    <div className="fl-page">
      <PageHeader eyebrow="Admin" title="Support requests" text="Questions and problems sent by users. Reply in the thread; the user is notified." />
      <div className="d-flex flex-wrap gap-2 mb-3">
        {[['open', `Waiting (${count('open')})`], ['answered', `Replied (${count('answered')})`], ['closed', `Closed (${count('closed')})`], ['all', 'All']].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card h-auto"><EmptyState icon="bi-headset" title="Nothing here" text="New requests appear here and you get a notification." /></div>
      ) : (
        <div className="fl-card p-2 h-auto">
          {rows.map((t) => (
            <Link key={t.id} to={`/admin/support/${t.id}`} className="fl-list-item">
              <Avatar profile={t.user} size={40} />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{t.subject}</div>
                <div className="small text-muted-fl text-truncate">{displayName(t.user)} · {ROLE_LABELS[t.user.role]} · {CATEGORIES[t.category]} · {timeAgo(t.last_message_at)}</div>
              </div>
              <Status s={t.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
