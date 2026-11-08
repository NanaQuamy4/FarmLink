import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, Avatar, ActionButton, Field } from '../../../components/ui'
import ChatThread from '../../../components/ChatThread'
import { REGIONS, CROPS } from '../../../lib/constants'
import { timeAgo, displayName } from '../../../lib/format'

// FR12: farmer community groups by region or crop.
export function GroupList() {
  const { profile } = useAuth()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState({ name: '', description: '', region: profile.region || '', crop: '' })
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(() => supabase.from('groups').select('*, group_members(user_id)').order('created_at', { ascending: false }), [])
  const rows = (data || []).filter((g) => !q || [g.name, g.region, g.crop, g.description].join(' ').toLowerCase().includes(q.toLowerCase()))
  const mine = rows.filter((g) => g.group_members.some((m) => m.user_id === profile.id))
  const others = rows.filter((g) => !g.group_members.some((m) => m.user_id === profile.id))

  async function join(g) {
    const { error: e } = await supabase.from('group_members').insert({ group_id: g.id, user_id: profile.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function create(e) {
    e.preventDefault()
    const { error: e2 } = await supabase.from('groups').insert({ name: f.name.trim(), description: f.description || null, region: f.region || null, crop: f.crop || null, created_by: profile.id })
    if (e2) return setErr(errorMessage(e2))
    setCreating(false)
    reload()
  }

  const Card = ({ g, member }) => (
    <div className="col-md-6 col-xl-4">
      <div className="fl-card fl-lift p-4 h-100 d-flex flex-column">
        <div className="d-flex gap-3 mb-2">
          <span className="fl-icon-tile flex-none"><i className={`bi ${g.crop ? 'bi-flower1' : 'bi-geo-alt'}`} /></span>
          <div className="min-w-0"><Link to={`/groups/${g.id}`} className="fw-semibold text-reset d-block text-truncate">{g.name}</Link><div className="small text-muted-fl">{[g.crop, g.region].filter(Boolean).join(' · ') || 'Open group'} · {g.group_members.length} members</div></div>
        </div>
        {g.description && <p className="small text-muted-fl text-truncate-2 flex-grow-1">{g.description}</p>}
        {member ? <Link to={`/groups/${g.id}`} className="btn btn-primary btn-sm mt-auto">Open</Link> : <ActionButton className="btn btn-outline-primary btn-sm mt-auto" onClick={() => join(g)}>Join group</ActionButton>}
      </div>
    </div>
  )

  return (
    <div className="fl-page">
      <PageHeader image="/images/farmers-weeding.jpg" eyebrow="Farmer groups" title="Farm together," accent="like nnoboa." text="Organise labour days, buy inputs together and share what works."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(!creating)}><i className="bi bi-plus-lg me-1" />Start a group</button>} />
      <ErrorAlert error={err || error} onRetry={error ? reload : undefined} />
      {creating && (
        <form className="fl-card p-4 mb-4 row g-3" onSubmit={create}>
          <Field className="col-md-6" label="Group name" htmlFor="g-name"><input id="g-name" className="form-control" required minLength={3} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field className="col-md-3" label="Region" htmlFor="g-region"><select id="g-region" className="form-select" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}><option value="">Any</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field className="col-md-3" label="Crop" htmlFor="g-crop"><select id="g-crop" className="form-select" value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })}><option value="">Any</option>{CROPS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field className="col-12" label="What is it for?" htmlFor="g-desc"><textarea id="g-desc" className="form-control" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="col-12"><button className="btn btn-primary">Create group</button></div>
        </form>
      )}
      <input className="form-control mb-4" style={{ maxWidth: 360 }} placeholder="Search groups by name, region or crop" aria-label="Search groups" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Loading /> : (
        <>
          {mine.length > 0 && <><h2 className="h5 mb-3">Your groups</h2><div className="row g-3 mb-5">{mine.map((g) => <Card key={g.id} g={g} member />)}</div></>}
          <h2 className="h5 mb-3">Discover</h2>
          {others.length === 0 ? <div className="fl-card"><EmptyState icon="bi-people" title="No other groups yet" text="Start one for your area or crop." /></div> : <div className="row g-3">{others.map((g) => <Card key={g.id} g={g} />)}</div>}
        </>
      )}
    </div>
  )
}

export function GroupDetail() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const [notice, setNotice] = useState({ title: '', body: '' })
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const [g, members, notices] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, profile:profiles!group_members_user_id_fkey(id, full_name, is_group, group_name, avatar_url, region)').eq('group_id', id).order('joined_at'),
      supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(full_name)').eq('group_id', id).eq('is_notice', true).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    ])
    if (g.error) throw g.error
    return { g: g.data, members: members.data || [], notices: notices.data || [] }
  }, [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { g, members, notices } = data
  const me = members.find((m) => m.user_id === profile.id)
  const isLeader = me?.member_role === 'leader' || role === 'admin'

  async function join() {
    const { error: e } = await supabase.from('group_members').insert({ group_id: id, user_id: profile.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function leave() {
    const { error: e } = await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', profile.id)
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function post(e) {
    e.preventDefault()
    const { error: e2 } = await supabase.from('messages').insert({ group_id: id, sender_id: profile.id, body: notice.body, notice_title: notice.title, is_notice: true })
    if (e2) return setErr(errorMessage(e2))
    setNotice({ title: '', body: '' })
    reload()
  }
  async function togglePin(n) {
    const { error: e } = await supabase.from('messages').update({ pinned: !n.pinned }).eq('id', n.id)
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <Link to="/groups" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Groups</Link>
      <PageHeader eyebrow={[g.crop, g.region].filter(Boolean).join(' · ') || 'Group'} title={g.name} text={g.description}
        actions={me ? (me.member_role !== 'leader' && <ActionButton className="btn btn-outline-danger" confirm="Leave this group?" onClick={leave}>Leave group</ActionButton>) : <ActionButton className="btn btn-primary" onClick={join}>Join group</ActionButton>} />
      <ErrorAlert error={err} />
      {!me && role !== 'admin' ? (
        <div className="fl-card"><EmptyState icon="bi-lock" title="Join to see the notice board and chat" text={`${members.length} members.`} /></div>
      ) : (
        <div className="row g-4">
          <div className="col-lg-5 d-grid gap-4 align-content-start">
            <section className="fl-card p-4">
              <h2 className="h5"><i className="bi bi-pin-angle me-1" />Notice board</h2>
              {notices.length === 0 && <p className="small text-muted-fl">No notices yet.</p>}
              {notices.map((n) => (
                <div key={n.id} className="border-top py-3">
                  <div className="d-flex justify-content-between gap-2">
                    <div className="fw-semibold">{n.pinned && <i className="bi bi-pin-fill text-ochre me-1" />}{n.notice_title || 'Notice'}</div>
                    {isLeader && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => togglePin(n)}>{n.pinned ? 'Unpin' : 'Pin'}</button>}
                  </div>
                  <div className="small" style={{ whiteSpace: 'pre-line' }}>{n.body}</div>
                  <div className="small text-muted-fl">{n.sender?.full_name} · {timeAgo(n.created_at)}</div>
                </div>
              ))}
              {me && (
                <form onSubmit={post} className="border-top pt-3 d-grid gap-2">
                  <input className="form-control" placeholder="Title, e.g. Nnoboa labour day" aria-label="Notice title" required value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} />
                  <textarea className="form-control" rows={2} placeholder="Where, when, what to bring…" aria-label="Notice text" required value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} />
                  <button className="btn btn-outline-primary btn-sm justify-self-start" style={{ justifySelf: 'start' }}>Post notice</button>
                </form>
              )}
            </section>
            <section className="fl-card p-4">
              <h2 className="h5">Members <span className="text-muted-fl fw-normal">({members.length})</span></h2>
              <div className="d-grid gap-1">
                {members.map((m) => (
                  <Link key={m.user_id} to={`/u/${m.user_id}`} className="fl-list-item py-2">
                    <Avatar profile={m.profile} size={32} /><span className="flex-grow-1">{displayName(m.profile)}</span>
                    {m.member_role === 'leader' && <span className="fl-pill lime" style={{ fontSize: '.7rem', padding: '.05rem .5rem' }}>Leader</span>}
                  </Link>
                ))}
              </div>
            </section>
          </div>
          <div className="col-lg-7">
            <section className="fl-card p-0 overflow-hidden">
              <div className="p-3 border-bottom fw-semibold"><i className="bi bi-chat-dots me-1" />Group chat</div>
              <ChatThread groupId={id} canSend={!!me} height="min(64vh, 600px)" placeholder="Message the group…" />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
