import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { photoUrl } from '../../../lib/storage'
import { PageHeader, Loading, ErrorAlert, EmptyState, ActionButton, Field, Avatar } from '../../../components/ui'
import { REGIONS } from '../../../lib/constants'
import { fmtDateTime, displayName, timeAgo } from '../../../lib/format'

// FR13/FR14: education sessions. Hosts are verifiers, admins and experts an admin approved.
// Video runs on Jitsi Meet in a new tab (free, no time limit; embedding meet.jit.si is limited
// to 5 minutes). FarmLink handles registration, attendance, materials, Q&A and feedback.

const COVERS = [
  ['/images/maize-field.jpg', 'Maize field'], ['/images/irrigating-farm.jpg', 'Irrigation'], ['/images/crop-rows.jpg', 'Crop rows'],
  ['/images/maize-harvest.jpg', 'Harvest'], ['/images/cabbage-farm.jpg', 'Vegetables'], ['/images/farmer-tablet.jpg', 'Farmer with tablet'],
  ['/images/cocoa-drying.jpg', 'Cocoa'], ['/images/cassava-harvest.jpg', 'Cassava'], ['/images/farmers-weeding.jpg', 'Group work'],
]
const endOf = (s) => new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000)
const stateOf = (s) => {
  const now = Date.now()
  const start = new Date(s.starts_at).getTime()
  if (now > endOf(s).getTime() + 30 * 60000) return 'ended'
  if (now >= start - 15 * 60000) return 'live'
  return 'upcoming'
}
const isPast = (s) => endOf(s).getTime() < Date.now()

function useCountdown(target) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  if (!target) return null
  const ms = new Date(target).getTime() - now
  if (ms <= 0) return null
  const d = Math.floor(ms / 864e5)
  const h = Math.floor((ms % 864e5) / 36e5)
  const m = Math.floor((ms % 36e5) / 6e4)
  return d > 0 ? `${d} day${d > 1 ? 's' : ''} ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`
}

// Add-to-calendar file with a 30-minute reminder
function downloadIcs(s) {
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const url = `${window.location.origin}/sessions/${s.id}`
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FarmLink//Sessions//EN', 'BEGIN:VEVENT', `UID:${s.id}@farmlink`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(s.starts_at)}`, `DTEND:${f(endOf(s))}`, `SUMMARY:${s.title.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:FarmLink session. Join from ${url}`, `URL:${url}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY',
    'DESCRIPTION:Session starts soon', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${s.title.replace(/\W+/g, '-').toLowerCase()}.ics`
  a.click()
}

export function useCanHost() {
  const { role, profile } = useAuth()
  return role === 'admin' || role === 'verifier' || !!profile?.can_host_sessions
}

// Create or edit a session
function SessionForm({ profile, session, onDone, onCancel }) {
  const start = session ? new Date(session.starts_at) : null
  const pad = (n) => String(n).padStart(2, '0')
  const [f, setF] = useState({
    title: session?.title || '', description: session?.description || '', topic: session?.topic || '', audience: session?.audience || '',
    agenda: session?.agenda || '', region: session?.region ?? (profile.region || ''), cover_image: session?.cover_image || COVERS[0][0],
    date: start ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : '',
    time: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '10:00',
    duration_minutes: session?.duration_minutes || 60, capacity: session?.capacity || 100,
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    setErr('')
    const starts = new Date(`${f.date}T${f.time}`)
    if (!f.title.trim()) return setErr('Give the session a title.')
    if (Number.isNaN(starts.getTime())) return setErr('Choose a date and time.')
    if (!session && starts < new Date()) return setErr('Choose a date and time in the future.')
    const row = {
      title: f.title.trim(), description: f.description || null, topic: f.topic || null, audience: f.audience || null, agenda: f.agenda || null,
      region: f.region || null, cover_image: f.cover_image, starts_at: starts.toISOString(),
      duration_minutes: Number(f.duration_minutes), capacity: Number(f.capacity),
    }
    const q = session
      ? supabase.from('sessions').update(row).eq('id', session.id).select('id').single()
      : supabase.from('sessions').insert({ ...row, host_id: profile.id }).select('id').single()
    const { data, error } = await q
    if (error) return setErr(errorMessage(error))
    onDone(data.id)
  }

  return (
    <div className="fl-card p-4 mb-4 h-auto">
      <h2 className="h5">{session ? 'Edit session' : 'Schedule a session'}</h2>
      <p className="small text-muted-fl">Registered farmers are notified if you change the time or post notes later.</p>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <div className="row g-3">
        <Field className="col-md-8" label="Title" htmlFor="s-title"><input id="s-title" className="form-control" value={f.title} onChange={set('title')} /></Field>
        <Field className="col-md-4" label="Topic" htmlFor="s-topic"><input id="s-topic" className="form-control" placeholder="e.g. Maize, Soil" value={f.topic} onChange={set('topic')} /></Field>
        <Field className="col-md-7" label="What will you cover?" htmlFor="s-desc"><textarea id="s-desc" className="form-control" rows={3} value={f.description} onChange={set('description')} /></Field>
        <Field className="col-md-5" label="Agenda (one item per line)" htmlFor="s-agenda"><textarea id="s-agenda" className="form-control" rows={3} value={f.agenda} onChange={set('agenda')} /></Field>
        <Field className="col-md-6" label="Who is it for?" htmlFor="s-aud"><input id="s-aud" className="form-control" placeholder="e.g. New maize farmers in Bono East" value={f.audience} onChange={set('audience')} /></Field>
        <Field className="col-md-6" label="Region" htmlFor="s-region">
          <select id="s-region" className="form-select" value={f.region} onChange={set('region')}><option value="">All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field className="col-6 col-md-3" label="Date" htmlFor="s-date"><input id="s-date" type="date" className="form-control" value={f.date} onChange={set('date')} /></Field>
        <Field className="col-6 col-md-3" label="Time (Ghana)" htmlFor="s-time"><input id="s-time" type="time" className="form-control" value={f.time} onChange={set('time')} /></Field>
        <Field className="col-6 col-md-3" label="Minutes" htmlFor="s-dur"><input id="s-dur" type="number" min="15" max="480" className="form-control" value={f.duration_minutes} onChange={set('duration_minutes')} /></Field>
        <Field className="col-6 col-md-3" label="Seats" htmlFor="s-cap"><input id="s-cap" type="number" min="1" max="1000" className="form-control" value={f.capacity} onChange={set('capacity')} /></Field>
        <div className="col-12">
          <span className="form-label d-block">Cover photo</span>
          <div className="d-flex flex-wrap gap-2">
            {COVERS.map(([src, label]) => (
              <button key={src} type="button" aria-label={label} aria-pressed={f.cover_image === src} onClick={() => setF({ ...f, cover_image: src })}
                className="p-0 border-0 rounded-3 overflow-hidden" style={{ outline: f.cover_image === src ? '3px solid var(--fl-lime)' : 'none', outlineOffset: 2 }}>
                <img src={src} alt="" className="d-block object-fit-cover" style={{ width: 92, height: 62, opacity: f.cover_image === src ? 1 : 0.7 }} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="d-flex gap-2 mt-4">
        <ActionButton className="btn btn-primary" onClick={submit}>{session ? 'Save changes' : 'Schedule session'}</ActionButton>
        <button type="button" className="btn btn-outline-primary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ---------- List ----------
export function SessionList() {
  const { profile } = useAuth()
  const canHost = useCanHost()
  const [tab, setTab] = useState('upcoming')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const [s, regs, seats] = await Promise.all([
      supabase.from('sessions').select('*, host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)').order('starts_at'),
      supabase.from('session_registrations').select('session_id, attended_at').eq('user_id', profile.id),
      supabase.rpc('session_seats'),
    ])
    if (s.error) throw s.error
    const taken = Object.fromEntries((seats.data || []).map((r) => [r.session_id, r.taken]))
    return { sessions: s.data.map((x) => ({ ...x, taken: taken[x.id] || 0 })), mine: Object.fromEntries((regs.data || []).map((r) => [r.session_id, r])) }
  }, [profile.id])

  const rows = (data?.sessions || []).filter((s) => (tab === 'upcoming' ? !isPast(s) : tab === 'mine' ? s.host_id === profile.id : isPast(s)))
  if (tab === 'past') rows.reverse()

  async function register(s) {
    setErr('')
    const { error: e } = await supabase.from('session_registrations').insert({ session_id: s.id, user_id: profile.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <PageHeader image="/images/farmer-tablet.jpg" eyebrow="Education sessions" title="Learn from experts," accent="wherever you farm."
        text="Live video sessions with extension officers and experts. Join from any phone browser, ask questions and keep the notes."
        actions={canHost && <button type="button" className="btn btn-primary btn-lg" onClick={() => setCreating(!creating)}><i className="bi bi-plus-lg me-1" />Schedule a session</button>} />
      {creating && <SessionForm profile={profile} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); reload() }} />}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {[['upcoming', 'Upcoming'], ['past', 'Notes & recordings'], ...(canHost ? [['mine', 'Hosted by me']] : [])].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <ErrorAlert error={err || error} onRetry={error ? reload : undefined} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-camera-video" title={tab === 'upcoming' ? 'No upcoming sessions' : 'Nothing here yet'}
          text={canHost ? 'Schedule a session to reach many farmers at once.' : 'New sessions will appear here.'} /></div>
      ) : (
        <div className="row g-3">
          {rows.map((s) => {
            const d = new Date(s.starts_at)
            const reg = data.mine[s.id]
            const st = stateOf(s)
            return (
              <div className="col-md-6 col-xl-4" key={s.id}>
                <div className="fl-session-card fl-lift h-100">
                  <Link to={`/sessions/${s.id}`} className="fl-session-cover">
                    <img src={s.cover_image || '/images/farmer-tablet.jpg'} alt="" />
                    <span className="fl-session-date"><span>{d.toLocaleDateString('en-GB', { month: 'short' })}</span><strong>{d.getDate()}</strong></span>
                    {st === 'live' && <span className="fl-pill lime position-absolute top-0 end-0 m-3"><span className="fl-live-dot" />Live now</span>}
                    {s.topic && st !== 'live' && <span className="fl-pill glass position-absolute top-0 end-0 m-3">{s.topic}</span>}
                  </Link>
                  <div className="p-3 d-flex flex-column flex-grow-1">
                    <Link to={`/sessions/${s.id}`} className="fw-semibold text-reset text-decoration-none lh-sm mb-1">{s.title}</Link>
                    <div className="small text-muted-fl mb-2">{fmtDateTime(s.starts_at)} · {s.duration_minutes} min</div>
                    <div className="d-flex align-items-center gap-2 small mb-3">
                      <Avatar profile={s.host} size={24} /><span className="text-truncate">{s.host?.full_name}</span>{s.region && <span className="text-muted-fl">· {s.region}</span>}
                    </div>
                    {tab !== 'past' && (
                      <>
                        <div className="progress mb-1" style={{ height: 5 }}><div className="progress-bar bg-primary" style={{ width: `${Math.min(100, (s.taken / s.capacity) * 100)}%` }} /></div>
                        <div className="small text-muted-fl mb-3">{s.taken} of {s.capacity} seats taken</div>
                      </>
                    )}
                    <div className="mt-auto d-flex gap-2">
                      {s.host_id === profile.id ? <Link to={`/sessions/${s.id}`} className="btn btn-sm btn-primary w-100">Open host room</Link>
                        : isPast(s) ? <Link to={`/sessions/${s.id}?tab=materials`} className="btn btn-sm btn-outline-primary w-100"><i className="bi bi-journal-text me-1" />Notes & materials{reg?.attended_at ? ' · attended' : ''}</Link>
                          : reg ? <Link to={`/sessions/${s.id}`} className="btn btn-sm btn-lime w-100"><i className="bi bi-check-lg me-1" />Registered · open</Link>
                            : <ActionButton className="btn btn-sm btn-outline-primary w-100" disabled={s.taken >= s.capacity} onClick={() => register(s)}>{s.taken >= s.capacity ? 'Full' : 'Register'}</ActionButton>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Q&A (live) ----------
function QandA({ s, isHost, canAsk }) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [votes, setVotes] = useState([])
  const [text, setText] = useState('')
  const [answers, setAnswers] = useState({})
  const [err, setErr] = useState('')

  const load = async () => {
    const q = await supabase.from('session_questions')
      .select('*, asker:profiles!session_questions_user_id_fkey(id, full_name, is_group, group_name, avatar_url)').eq('session_id', s.id)
    const ids = (q.data || []).map((x) => x.id)
    const v = ids.length ? await supabase.from('session_question_votes').select('question_id, user_id').in('question_id', ids) : { data: [] }
    setItems(q.data || [])
    setVotes(v.data || [])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel(`qa:${s.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_questions', filter: `session_id=eq.${s.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_question_votes' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id])

  const sorted = useMemo(() => {
    const count = (id) => votes.filter((v) => v.question_id === id).length
    return [...items].map((q) => ({ ...q, votes: count(q.id), mine: votes.some((v) => v.question_id === q.id && v.user_id === profile.id) }))
      .sort((a, b) => (!!a.answered_at - !!b.answered_at) || b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at))
  }, [items, votes, profile.id])

  async function ask(e) {
    e.preventDefault()
    if (text.trim().length < 3) return
    const { error } = await supabase.from('session_questions').insert({ session_id: s.id, user_id: profile.id, body: text.trim() })
    if (error) return setErr(errorMessage(error))
    setText('')
    load()
  }
  async function vote(q) {
    const { error } = q.mine
      ? await supabase.from('session_question_votes').delete().eq('question_id', q.id).eq('user_id', profile.id)
      : await supabase.from('session_question_votes').insert({ question_id: q.id, user_id: profile.id })
    if (error) return setErr(errorMessage(error))
    load()
  }
  async function answer(q) {
    const { error } = await supabase.rpc('answer_question', { p_question: q.id, p_answer: answers[q.id] ?? q.answer ?? '' })
    if (error) return setErr(errorMessage(error))
    load()
  }
  async function remove(q) {
    await supabase.from('session_questions').delete().eq('id', q.id)
    load()
  }

  return (
    <div className="d-grid gap-3">
      {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
      {canAsk && (
        <form onSubmit={ask} className="fl-card p-3 d-flex gap-2 h-auto">
          <label htmlFor="qa-ask" className="visually-hidden">Your question</label>
          <input id="qa-ask" className="form-control" maxLength={1000} placeholder={isHost ? 'Add a question to cover…' : 'Ask the host a question, before or during the session'} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary flex-none" disabled={text.trim().length < 3}>Ask</button>
        </form>
      )}
      {sorted.length === 0 && <div className="fl-card p-4 text-center text-muted-fl h-auto">No questions yet. Questions with the most votes rise to the top.</div>}
      {sorted.map((q) => (
        <div key={q.id} className="fl-card p-3 d-flex gap-3 h-auto fl-swap">
          <button type="button" onClick={() => vote(q)} aria-pressed={q.mine} aria-label={q.mine ? 'Remove vote' : 'Vote for this question'}
            className={`fl-vote flex-none ${q.mine ? 'on' : ''}`}><i className="bi bi-caret-up-fill" /><span>{q.votes}</span></button>
          <div className="flex-grow-1 min-w-0">
            <div className="fw-semibold">{q.body}</div>
            <div className="small text-muted-fl d-flex flex-wrap gap-2 align-items-center">
              <span>{displayName(q.asker)} · {timeAgo(q.created_at)}</span>
              {q.answered_at && <span className="fl-status verified">Answered</span>}
              {(q.user_id === profile.id || isHost) && <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => remove(q)}>Delete</button>}
            </div>
            {q.answer && <div className="mt-2 p-2 rounded-3 small" style={{ background: '#EEF6E6' }}><strong>Host:</strong> {q.answer}</div>}
            {isHost && (
              <div className="d-flex gap-2 mt-2">
                <input className="form-control form-control-sm" aria-label="Answer" placeholder={q.answer ? 'Edit answer' : 'Write an answer, or answer live and note it here'}
                  value={answers[q.id] ?? q.answer ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                <button type="button" className="btn btn-sm btn-outline-primary flex-none" onClick={() => answer(q)}>{q.answer ? 'Update' : 'Answer'}</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Materials ----------
function Materials({ s, isHost, reload, resources }) {
  const { profile } = useAuth()
  const [f, setF] = useState({ title: '', url: '' })
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')

  async function add() {
    setErr('')
    try {
      let storagePath = null
      if (file) {
        storagePath = `${s.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`
        const up = await supabase.storage.from('session-files').upload(storagePath, file, { contentType: file.type })
        if (up.error) throw up.error
      }
      const { error } = await supabase.from('session_resources').insert({
        session_id: s.id, title: f.title || file?.name || f.url, url: file ? null : f.url, storage_path: storagePath, added_by: profile.id,
      })
      if (error) throw error
      setF({ title: '', url: '' })
      setFile(null)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }
  async function open(r) {
    const url = r.url || (await photoUrl(r.storage_path, 'session-files'))
    if (url) window.open(url, '_blank', 'noopener')
  }
  async function remove(r) {
    if (r.storage_path) await supabase.storage.from('session-files').remove([r.storage_path])
    await supabase.from('session_resources').delete().eq('id', r.id)
    reload()
  }

  const all = [
    ...resources,
    ...(s.notes_url ? [{ id: 'notes', title: 'Session notes', url: s.notes_url, icon: 'bi-journal-text' }] : []),
    ...(s.recording_url ? [{ id: 'rec', title: 'Recording', url: s.recording_url, icon: 'bi-play-circle' }] : []),
  ]

  return (
    <div className="d-grid gap-3">
      {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
      <div className="fl-card p-2 h-auto">
        {all.length === 0 && <p className="text-muted-fl small p-3 mb-0">{isHost ? 'Share slides, handouts or links. Registered farmers are notified.' : 'The host has not shared materials yet.'}</p>}
        {all.map((r) => (
          <div key={r.id} className="fl-list-item">
            <span className="fl-icon-tile soft flex-none"><i className={`bi ${r.icon || (r.storage_path ? 'bi-file-earmark-arrow-down' : 'bi-link-45deg')}`} /></span>
            <button type="button" className="btn btn-link text-reset text-decoration-none text-start p-0 flex-grow-1 min-w-0" onClick={() => open(r)}>
              <div className="fw-semibold text-truncate">{r.title}</div>
              <div className="small text-muted-fl text-truncate">{r.storage_path ? 'File' : r.url}</div>
            </button>
            {isHost && !['notes', 'rec'].includes(r.id) && <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => remove(r)}>Remove</button>}
          </div>
        ))}
      </div>
      {isHost && (
        <div className="fl-card p-3 h-auto">
          <div className="fw-semibold mb-2">Share a file or link</div>
          <div className="row g-2">
            <div className="col-md-4"><input className="form-control" aria-label="Title" placeholder="Title, e.g. Slides" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="col-md-4"><input type="file" className="form-control" aria-label="File" accept=".pdf,.ppt,.pptx,.docx,image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
            <div className="col-md-4"><input className="form-control" aria-label="Or a link" placeholder="or a link (https://…)" value={f.url} disabled={!!file} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
          </div>
          <ActionButton className="btn btn-outline-primary btn-sm mt-2" disabled={!file && !/^https?:\/\//.test(f.url)} onClick={add}>Share</ActionButton>
          <div className="small text-muted-fl mt-1">Files up to 10 MB: PDF, PowerPoint, Word or images.</div>
        </div>
      )}
    </div>
  )
}

const CALL_TOOLS = [
  ['bi-display', 'Share your screen', 'Show slides, photos or a website, from a laptop or desktop browser.'],
  ['bi-chat-dots', 'Chat', 'Type questions or share links with everyone.'],
  ['bi-hand-index-thumb', 'Raise your hand', 'Ask to speak without interrupting.'],
  ['bi-bar-chart-steps', 'Polls', 'The host can ask the room quick questions.'],
  ['bi-grid-3x3-gap', 'Tile view', 'See everyone, or pin the speaker.'],
  ['bi-reception-2', 'Low bandwidth', 'Join audio-only or lower the video quality to save data.'],
]

// ---------- Session room ----------
export function SessionDetail() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const [links, setLinks] = useState(null)
  const [fb, setFb] = useState({ score: 5, comment: '' })
  const [copied, setCopied] = useState(false)

  const { data, loading, error, reload } = useQuery(async () => {
    const [s, reg, regs, sum, res, myFb, allFb] = await Promise.all([
      supabase.from('sessions').select('*, host:profiles!sessions_host_id_fkey(id, full_name, avatar_url, region, bio)').eq('id', id).single(),
      supabase.from('session_registrations').select('*').eq('session_id', id).eq('user_id', profile.id).maybeSingle(),
      supabase.from('session_registrations').select('*, profile:profiles!session_registrations_user_id_fkey(id, full_name, is_group, group_name, avatar_url, region)').eq('session_id', id).order('registered_at'),
      supabase.rpc('session_summary', { p_session: id }),
      supabase.from('session_resources').select('*').eq('session_id', id).order('created_at'),
      supabase.from('session_feedback').select('*').eq('session_id', id).eq('user_id', profile.id).maybeSingle(),
      supabase.from('session_feedback').select('*, profile:profiles!session_feedback_user_id_fkey(full_name)').eq('session_id', id).order('created_at', { ascending: false }),
    ])
    if (s.error) throw s.error
    return { s: s.data, reg: reg.data, regs: regs.data || [], sum: sum.data || {}, resources: res.data || [], myFb: myFb.data, allFb: allFb.data || [] }
  }, [id, profile.id])
  const countdown = useCountdown(data?.s?.starts_at)

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { s, reg, regs, sum, resources, myFb, allFb } = data
  const isHost = s.host_id === profile.id || role === 'admin'
  const st = stateOf(s)
  const full = (sum.registered || 0) >= s.capacity
  const l = links || { notes_url: s.notes_url || '', recording_url: s.recording_url || '' }
  const agenda = (s.agenda || '').split('\n').map((x) => x.trim()).filter(Boolean)

  async function join(audioOnly) {
    setErr('')
    const { data: url, error: e } = await supabase.rpc('join_session', { p_session: id })
    if (e) return setErr(errorMessage(e))
    const opts = [`userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName(profile)))}`, `config.subject=${encodeURIComponent(JSON.stringify(s.title))}`]
    if (audioOnly) opts.push('config.startAudioOnly=true', 'config.startWithVideoMuted=true')
    window.open(`${url}#${opts.join('&')}`, '_blank', 'noopener')
    reload()
  }
  async function register() {
    const { error: e } = await supabase.from('session_registrations').insert({ session_id: id, user_id: profile.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function cancel() {
    const { error: e } = await supabase.from('session_registrations').delete().eq('session_id', id).eq('user_id', profile.id)
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function saveLinks() {
    const { error: e } = await supabase.from('sessions').update({ notes_url: l.notes_url || null, recording_url: l.recording_url || null }).eq('id', id)
    if (e) return setErr(errorMessage(e))
    setLinks(null)
    reload()
  }
  async function sendFeedback() {
    const { error: e } = await supabase.from('session_feedback').insert({ session_id: id, user_id: profile.id, score: fb.score, comment: fb.comment || null })
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function deleteSession() {
    const { error: e } = await supabase.from('sessions').delete().eq('id', id)
    if (e) return setErr(errorMessage(e))
    window.location.assign('/sessions')
  }
  function exportAttendance() {
    const rows = [['Name', 'Region', 'Registered', 'Attended']].concat(
      regs.map((r) => [displayName(r.profile), r.profile?.region || '', fmtDateTime(r.registered_at), r.attended_at ? fmtDateTime(r.attended_at) : 'No']))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `attendance-${s.title.replace(/\W+/g, '-').toLowerCase()}.csv`
    a.click()
  }
  async function copyLink() {
    await navigator.clipboard?.writeText(`${window.location.origin}/sessions/${s.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [['overview', 'Overview', 'bi-info-circle'], ['materials', 'Materials', 'bi-folder2-open'], ['qa', 'Q&A', 'bi-chat-square-quote'],
    ...(isHost ? [['people', 'Attendance', 'bi-people']] : []), ...(st !== 'upcoming' ? [['feedback', 'Feedback', 'bi-star']] : [])]

  return (
    <div className="fl-page">
      <Link to="/sessions" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Sessions</Link>
      <PageHeader image={s.cover_image || '/images/farmer-tablet.jpg'} eyebrow={[s.topic, s.region].filter(Boolean).join(' · ') || 'Education session'} title={s.title}
        text={`${fmtDateTime(s.starts_at)} · ${s.duration_minutes} minutes · hosted by ${s.host.full_name}`}
        actions={st === 'live' ? <span className="fl-pill lime"><span className="fl-live-dot" />Live now</span> : st === 'ended' ? <span className="fl-pill dark">Ended</span> : null}
        stats={[
          { icon: 'bi-clock', label: st === 'upcoming' ? 'Starts in' : 'Status', value: st === 'upcoming' ? countdown || 'soon' : st === 'live' ? 'Live' : 'Ended', highlight: st === 'live' },
          { icon: 'bi-people', label: 'Registered', value: `${sum.registered || 0}/${s.capacity}` },
          { icon: 'bi-chat-square-quote', label: 'Questions', value: sum.questions || 0, to: `/sessions/${id}?tab=qa` },
          ...(st !== 'upcoming' ? [{ icon: 'bi-person-check', label: 'Attended', value: sum.attended || 0 }] : []),
        ]} />
      <ErrorAlert error={err} />
      {editing && <SessionForm profile={profile} session={s} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); reload() }} />}

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="fl-tabs mb-3" role="tablist">
            {tabs.map(([k, label, icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`fl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                <i className={`bi ${icon}`} /><span>{label}</span>
                {k === 'qa' && sum.questions > 0 && <span className="badge rounded-pill bg-secondary ms-1">{sum.questions}</span>}
              </button>
            ))}
          </div>
          <div key={tab} className="fl-swap">
            {tab === 'overview' && (
              <div className="d-grid gap-3">
                <section className="fl-card p-4 h-auto">
                  {s.audience && <div className="small text-muted-fl mb-2"><i className="bi bi-person-check me-1" />For: {s.audience}</div>}
                  {s.description ? <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{s.description}</p> : <p className="text-muted-fl mb-0">No description yet.</p>}
                </section>
                {agenda.length > 0 && (
                  <section className="fl-card p-4 h-auto">
                    <h2 className="h5 mb-3">Agenda</h2>
                    <ol className="fl-agenda mb-0">{agenda.map((a) => <li key={a}>{a}</li>)}</ol>
                  </section>
                )}
                <section className="fl-band fl-on-dark">
                  <h2 className="h5 mb-1">Inside the call</h2>
                  <p className="small mb-3" style={{ opacity: 0.8 }}>The session runs on Jitsi Meet in a new tab. It is free, participants need no account, and it works in Chrome, Edge or Firefox.</p>
                  <div className="row g-2">
                    {CALL_TOOLS.map(([icon, t, d]) => (
                      <div className="col-sm-6" key={t}>
                        <div className="fl-card-dark d-flex gap-3 p-3">
                          <span className="fl-icon-tile flex-none" style={{ width: 38, height: 38, fontSize: '1rem' }}><i className={`bi ${icon}`} /></span>
                          <div><div className="fw-semibold text-white small">{t}</div><div className="small" style={{ opacity: 0.75 }}>{d}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="small mt-3 mb-0" style={{ opacity: 0.7 }}>On a phone, Jitsi may suggest its free app; you can also continue in the browser. Sharing your screen from a phone needs the app.</p>
                </section>
              </div>
            )}
            {tab === 'materials' && <Materials s={s} isHost={isHost} resources={resources} reload={reload} />}
            {tab === 'qa' && <QandA s={s} isHost={isHost} canAsk={st !== 'ended' || isHost} />}
            {tab === 'people' && isHost && (
              <section className="fl-card p-3 h-auto">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="fw-semibold">{sum.registered} registered · {sum.attended} attended</div>
                  <button type="button" className="btn btn-sm btn-outline-primary" disabled={!regs.length} onClick={exportAttendance}><i className="bi bi-download me-1" />Export CSV</button>
                </div>
                {regs.length === 0 ? <p className="small text-muted-fl mb-0">No registrations yet.</p> : regs.map((r) => (
                  <div key={r.user_id} className="d-flex align-items-center gap-2 py-2 border-top">
                    <Avatar profile={r.profile} size={32} />
                    <div className="flex-grow-1"><div className="small fw-semibold">{displayName(r.profile)}</div><div className="small text-muted-fl">{r.profile?.region} · registered {timeAgo(r.registered_at)}</div></div>
                    {r.attended_at ? <span className="fl-status verified">Joined {new Date(r.attended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> : <span className="fl-status neutral">Registered</span>}
                  </div>
                ))}
              </section>
            )}
            {tab === 'feedback' && (
              <div className="d-grid gap-3">
                {!isHost && reg && !myFb && (
                  <section className="fl-card p-4 h-auto">
                    <h2 className="h5">How was this session?</h2>
                    <div className="d-flex gap-1 mb-3" role="radiogroup" aria-label="Score">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={fb.score === n} aria-label={`${n} stars`} className="btn btn-link p-0 fs-3 text-ochre" onClick={() => setFb({ ...fb, score: n })}>
                          <i className={`bi ${n <= fb.score ? 'bi-star-fill' : 'bi-star'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea className="form-control mb-3" rows={2} aria-label="Comment" placeholder="What was most useful? What should the host cover next time?" value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} />
                    <ActionButton className="btn btn-primary" onClick={sendFeedback}>Send feedback</ActionButton>
                  </section>
                )}
                {myFb && <div className="fl-card p-4 h-auto"><i className="bi bi-star-fill text-ochre me-1" />You rated this session {myFb.score}/5. Thank you.</div>}
                {!reg && !isHost && <div className="fl-card p-4 h-auto text-muted-fl">Feedback is for people who registered.</div>}
                {isHost && (
                  <section className="fl-card p-4 h-auto">
                    <h2 className="h5">{sum.feedback_count ? `Average ${sum.feedback_average}/5 from ${sum.feedback_count}` : 'No feedback yet'}</h2>
                    {allFb.map((x) => (
                      <div key={x.user_id} className="border-top py-2 small">
                        <span className="text-ochre">{'★'.repeat(x.score)}{'☆'.repeat(5 - x.score)}</span> {x.profile?.full_name}
                        {x.comment && <div>{x.comment}</div>}
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="d-grid gap-3" style={{ position: 'sticky', top: '6.5rem' }}>
            <div className="fl-card p-4 h-auto d-grid gap-2">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Avatar profile={s.host} size={40} /><div><div className="small text-muted-fl">Host</div><div className="fw-semibold">{s.host.full_name}</div></div>
              </div>
              {isHost ? (
                st === 'ended' ? <p className="small text-muted-fl mb-0">This session has ended. Share notes and the recording below.</p> : (
                  <>
                    <ActionButton className="btn btn-primary btn-lg" disabled={st !== 'live'} onClick={() => join(false)}>
                      <i className="bi bi-broadcast me-1" />{st === 'live' ? 'Start the session' : 'Opens 15 min before'}
                    </ActionButton>
                    <div className="small text-muted-fl">On meet.jit.si the first person into a room signs in once with Google or GitHub to become moderator. Participants wait in the lobby until you arrive.</div>
                  </>
                )
              ) : st === 'ended' ? (
                <>
                  <p className="small text-muted-fl mb-1">This session has ended.{reg?.attended_at && ' You attended.'}</p>
                  <button type="button" className="btn btn-outline-primary" onClick={() => setTab('materials')}><i className="bi bi-journal-text me-1" />Notes & materials</button>
                </>
              ) : !reg ? (
                <ActionButton className="btn btn-primary btn-lg" disabled={full} onClick={register}>{full ? 'Session full' : 'Register for free'}</ActionButton>
              ) : st === 'live' ? (
                <>
                  <ActionButton className="btn btn-primary btn-lg" onClick={() => join(false)}><i className="bi bi-camera-video me-1" />Join with video</ActionButton>
                  <ActionButton className="btn btn-outline-primary" onClick={() => join(true)}><i className="bi bi-mic me-1" />Join audio only (saves data)</ActionButton>
                  <div className="small text-muted-fl">Your name is filled in for you. Attendance is recorded when you join.</div>
                </>
              ) : (
                <>
                  <div className="fl-pill lime justify-content-center py-2"><i className="bi bi-check-lg" />You are registered</div>
                  <div className="small text-muted-fl text-center">Join opens 15 minutes before the start{countdown ? ` (in ${countdown})` : ''}.</div>
                  <button type="button" className="btn btn-link btn-sm text-danger" onClick={cancel}>Cancel registration</button>
                </>
              )}
              {st !== 'ended' && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => downloadIcs(s)}><i className="bi bi-calendar-plus me-1" />Add to calendar</button>}
              <button type="button" className="btn btn-link btn-sm" onClick={copyLink}><i className={`bi ${copied ? 'bi-check2' : 'bi-link-45deg'} me-1`} />{copied ? 'Link copied' : 'Copy invite link'}</button>
            </div>

            {isHost && (
              <div className="fl-card p-4 h-auto d-grid gap-2">
                <h2 className="h6 mb-1">Host tools</h2>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setEditing(!editing)}><i className="bi bi-pencil me-1" />Edit details or reschedule</button>
                <div className="small fw-semibold mt-2">After the session (FR14)</div>
                <input className="form-control form-control-sm" placeholder="Link to notes or slides" aria-label="Notes link" value={l.notes_url} onChange={(e) => setLinks({ ...l, notes_url: e.target.value })} />
                <input className="form-control form-control-sm" placeholder="Link to the recording" aria-label="Recording link" value={l.recording_url} onChange={(e) => setLinks({ ...l, recording_url: e.target.value })} />
                <ActionButton className="btn btn-sm btn-primary" disabled={!links} onClick={saveLinks}>Save and notify registered</ActionButton>
                <div className="small text-muted-fl">Jitsi can record to Dropbox from the call menu. Or record on your laptop, upload to YouTube or Google Drive, and paste the link here.</div>
                {st === 'upcoming' && <ActionButton className="btn btn-link btn-sm text-danger" confirm="Delete this session? Registrations will be removed." onClick={deleteSession}>Delete session</ActionButton>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
