import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, ActionButton, Field, Avatar } from '../../../components/ui'
import { REGIONS } from '../../../lib/constants'
import { fmtDateTime, displayName } from '../../../lib/format'

const end = (s) => new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000)
const isLive = (s) => Date.now() >= new Date(s.starts_at).getTime() - 15 * 60000 && Date.now() <= end(s).getTime() + 30 * 60000
const isPast = (s) => end(s).getTime() < Date.now()

function SessionForm({ onDone, profile }) {
  const [f, setF] = useState({ title: '', description: '', topic: '', region: profile.region || '', date: '', time: '10:00', duration_minutes: 60, capacity: 100 })
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    const starts = new Date(`${f.date}T${f.time}`)
    if (Number.isNaN(starts.getTime()) || starts < new Date()) return setErr('Choose a date and time in the future.')
    const { error } = await supabase.from('sessions').insert({
      host_id: profile.id, title: f.title, description: f.description || null, topic: f.topic || null, region: f.region || null,
      starts_at: starts.toISOString(), duration_minutes: Number(f.duration_minutes), capacity: Number(f.capacity),
    })
    if (error) return setErr(errorMessage(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="fl-card p-4 mb-4 row g-3">
      <h2 className="h5 col-12 mb-0">Schedule a session</h2>
      {err && <div className="col-12"><div className="alert alert-danger py-2 mb-0">{err}</div></div>}
      <Field className="col-md-8" label="Title" htmlFor="s-title"><input id="s-title" className="form-control" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field className="col-md-4" label="Topic" htmlFor="s-topic"><input id="s-topic" className="form-control" placeholder="e.g. Maize, Soil" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
      <Field className="col-12" label="What will you cover?" htmlFor="s-desc"><textarea id="s-desc" className="form-control" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field className="col-6 col-md-3" label="Date" htmlFor="s-date"><input id="s-date" type="date" className="form-control" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field className="col-6 col-md-2" label="Time" htmlFor="s-time"><input id="s-time" type="time" className="form-control" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
      <Field className="col-4 col-md-2" label="Minutes" htmlFor="s-dur"><input id="s-dur" type="number" min="15" max="480" className="form-control" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></Field>
      <Field className="col-4 col-md-2" label="Seats" htmlFor="s-cap"><input id="s-cap" type="number" min="1" max="1000" className="form-control" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
      <Field className="col-4 col-md-3" label="Region" htmlFor="s-region"><select id="s-region" className="form-select" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}><option value="">All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <div className="col-12"><button className="btn btn-primary">Schedule</button></div>
    </form>
  )
}

// FR13: list of sessions with registration
export function SessionList() {
  const { profile, role } = useAuth()
  const canHost = role === 'verifier' || role === 'admin'
  const [tab, setTab] = useState('upcoming')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const [s, regs, seats] = await Promise.all([
      supabase.from('sessions').select('*, host:profiles!sessions_host_id_fkey(full_name, avatar_url)').order('starts_at'),
      supabase.from('session_registrations').select('session_id, attended_at').eq('user_id', profile.id),
      supabase.rpc('session_seats'),
    ])
    if (s.error) throw s.error
    const taken = Object.fromEntries((seats.data || []).map((r) => [r.session_id, r.taken]))
    return { sessions: s.data.map((x) => ({ ...x, taken: taken[x.id] || 0 })), mine: Object.fromEntries((regs.data || []).map((r) => [r.session_id, r])) }
  }, [profile.id])

  const rows = (data?.sessions || []).filter((s) => (tab === 'upcoming' ? !isPast(s) : isPast(s)))
  if (tab === 'past') rows.reverse()

  async function register(s) {
    setErr('')
    const { error: e } = await supabase.from('session_registrations').insert({ session_id: s.id, user_id: profile.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Learn" title="Education sessions" text="Live video sessions with extension officers and experts. Join from any phone browser."
        actions={canHost && <button type="button" className="btn btn-primary" onClick={() => setCreating(!creating)}><i className="bi bi-plus-lg me-1" />Schedule a session</button>} />
      {creating && <SessionForm profile={profile} onDone={() => { setCreating(false); reload() }} />}
      <div className="d-flex gap-2 mb-4">
        {[['upcoming', 'Upcoming'], ['past', 'Notes & recordings']].map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <ErrorAlert error={err || error} onRetry={error ? reload : undefined} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-camera-video" title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'} /></div>
      ) : (
        <div className="fl-card p-2">
          {rows.map((s) => {
            const d = new Date(s.starts_at)
            const reg = data.mine[s.id]
            const count = s.taken
            return (
              <div key={s.id} className="fl-list-item flex-wrap">
                <div className="text-center flex-none rounded-4 py-2" style={{ width: 64, background: '#E8F3D2' }}>
                  <div className="small fw-semibold text-deep text-uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                  <div className="fs-4 fw-semibold lh-1" style={{ fontFamily: 'Outfit' }}>{d.getDate()}</div>
                </div>
                <Link to={`/sessions/${s.id}`} className="flex-grow-1 min-w-0 text-reset text-decoration-none" style={{ flexBasis: 220 }}>
                  <div className="d-flex flex-wrap gap-2 align-items-center">{isLive(s) && <span className="fl-pill lime" style={{ fontSize: '.7rem', padding: '.05rem .5rem' }}><span className="fl-live-dot" />Live</span>}{s.topic && <span className="fl-pill" style={{ fontSize: '.7rem', padding: '.05rem .5rem' }}>{s.topic}</span>}</div>
                  <div className="fw-semibold">{s.title}</div>
                  <div className="small text-muted-fl">{fmtDateTime(s.starts_at)} · {s.duration_minutes} min · {s.host?.full_name}{s.region ? ` · ${s.region}` : ''}</div>
                  {tab === 'upcoming' && <div className="small text-muted-fl">{count} of {s.capacity} seats taken</div>}
                </Link>
                {tab === 'upcoming' ? (
                  s.host_id === profile.id ? <Link to={`/sessions/${s.id}`} className="btn btn-sm btn-outline-primary">Manage</Link>
                    : reg ? <span className="fl-pill lime"><i className="bi bi-check-lg" />Registered</span>
                      : <ActionButton className="btn btn-sm btn-outline-primary" disabled={count >= s.capacity} onClick={() => register(s)}>{count >= s.capacity ? 'Full' : 'Register'}</ActionButton>
                ) : (
                  <div className="d-flex gap-2">
                    {reg?.attended_at && <span className="fl-pill"><i className="bi bi-person-check" />Attended</span>}
                    {s.notes_url && <a href={s.notes_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="bi bi-journal-text me-1" />Notes</a>}
                    {s.recording_url && <a href={s.recording_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="bi bi-play-circle me-1" />Recording</a>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// FR13/FR14: one session: join (records attendance), host tools for notes and recordings
export function SessionDetail() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const [err, setErr] = useState('')
  const [links, setLinks] = useState(null)
  const { data, loading, error, reload } = useQuery(async () => {
    const [s, reg, regs, seats] = await Promise.all([
      supabase.from('sessions').select('*, host:profiles!sessions_host_id_fkey(id, full_name, avatar_url, region)').eq('id', id).single(),
      supabase.from('session_registrations').select('*').eq('session_id', id).eq('user_id', profile.id).maybeSingle(),
      supabase.from('session_registrations').select('*, profile:profiles!session_registrations_user_id_fkey(id, full_name, is_group, group_name, avatar_url)').eq('session_id', id),
      supabase.rpc('session_seats'),
    ])
    if (s.error) throw s.error
    const taken = (seats.data || []).find((r) => r.session_id === id)?.taken || 0
    return { s: s.data, reg: reg.data, regs: regs.data || [], taken }
  }, [id, profile.id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { s, reg, regs, taken } = data
  const isHost = s.host_id === profile.id || role === 'admin'
  const l = links || { notes_url: s.notes_url || '', recording_url: s.recording_url || '' }

  async function join() {
    setErr('')
    const { data: url, error: e } = await supabase.rpc('join_session', { p_session: id })
    if (e) return setErr(errorMessage(e))
    window.open(url, '_blank', 'noopener')
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

  return (
    <div className="fl-page" style={{ maxWidth: 980 }}>
      <Link to="/sessions" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Sessions</Link>
      <ErrorAlert error={err} />
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <section className="fl-card p-4">
            {s.topic && <span className="fl-pill mb-2">{s.topic}</span>}
            <h1 className="h3">{s.title}</h1>
            <div className="text-muted-fl mb-3"><i className="bi bi-calendar-event me-1" />{fmtDateTime(s.starts_at)} · {s.duration_minutes} minutes{s.region ? ` · ${s.region}` : ''}</div>
            {s.description && <p style={{ whiteSpace: 'pre-line' }}>{s.description}</p>}
            <div className="d-flex align-items-center gap-2 border-top pt-3"><Avatar profile={s.host} size={36} /><div><div className="small text-muted-fl">Hosted by</div><div className="fw-semibold">{s.host.full_name}</div></div></div>
          </section>
          {(s.notes_url || s.recording_url) && (
            <section className="fl-card p-4">
              <h2 className="h5">After the session</h2>
              <div className="d-flex flex-wrap gap-2">
                {s.notes_url && <a href={s.notes_url} target="_blank" rel="noreferrer" className="btn btn-outline-primary"><i className="bi bi-journal-text me-1" />Notes</a>}
                {s.recording_url && <a href={s.recording_url} target="_blank" rel="noreferrer" className="btn btn-outline-primary"><i className="bi bi-play-circle me-1" />Recording</a>}
              </div>
            </section>
          )}
        </div>
        <div className="col-lg-5 d-grid gap-3 align-content-start">
          <div className="fl-card p-4 d-grid gap-2">
            {isPast(s) ? <p className="mb-0 text-muted-fl">This session has ended.{reg?.attended_at && ' You attended.'}</p>
              : isLive(s) && (reg || isHost) ? <ActionButton className="btn btn-primary btn-lg" onClick={join}><i className="bi bi-camera-video me-1" />Join on Jitsi</ActionButton>
                : reg ? <><div className="fl-pill lime justify-content-center"><i className="bi bi-check-lg" />You are registered</div><p className="small text-muted-fl mb-0">The Join button appears 15 minutes before the start.</p><button type="button" className="btn btn-link btn-sm text-danger" onClick={cancel}>Cancel registration</button></>
                  : !isHost && <ActionButton className="btn btn-primary btn-lg" disabled={taken >= s.capacity} onClick={register}>{taken >= s.capacity ? 'Session full' : 'Register'}</ActionButton>}
            <div className="small text-muted-fl"><i className="bi bi-people me-1" />{taken} of {s.capacity} registered</div>
            <div className="small text-muted-fl"><i className="bi bi-box-arrow-up-right me-1" />Opens Jitsi Meet in a new tab. Attendance is recorded when you join.</div>
          </div>
          {isHost && (
            <>
              <div className="fl-card p-4 d-grid gap-2">
                <h2 className="h6 mb-1">Notes and recording (FR14)</h2>
                <input className="form-control" placeholder="Link to notes or slides" aria-label="Notes link" value={l.notes_url} onChange={(e) => setLinks({ ...l, notes_url: e.target.value })} />
                <input className="form-control" placeholder="Link to the recording" aria-label="Recording link" value={l.recording_url} onChange={(e) => setLinks({ ...l, recording_url: e.target.value })} />
                <ActionButton className="btn btn-outline-primary btn-sm" disabled={!links} onClick={saveLinks}>Save links</ActionButton>
              </div>
              <div className="fl-card p-4">
                <h2 className="h6">Registered and attendance</h2>
                {regs.length === 0 ? <p className="small text-muted-fl mb-0">No registrations yet.</p> : regs.map((r) => (
                  <div key={r.user_id} className="d-flex align-items-center gap-2 py-1"><Avatar profile={r.profile} size={28} /><span className="flex-grow-1 small">{displayName(r.profile)}</span>{r.attended_at ? <span className="fl-status verified">Attended</span> : <span className="fl-status neutral">Registered</span>}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
