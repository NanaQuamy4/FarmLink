import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { Loading, ErrorAlert, StatusBadge, Photo, Avatar, ActionButton, Field } from '../../../components/ui'
import { PlotMap } from '../../../components/Maps'
import { PLOT_STATUS, APPLICATION_STATUS, CROPS } from '../../../lib/constants'
import { fmtNumber, fmtDate, displayName, timeAgo } from '../../../lib/format'

function Gallery({ photos }) {
  const [i, setI] = useState(0)
  if (!photos.length) return <div className="fl-card d-grid text-muted-fl" style={{ height: 320, placeItems: 'center' }}><span><i className="bi bi-image me-2" />No photos</span></div>
  return (
    <div>
      <Photo key={photos[i].storage_path} path={photos[i].storage_path} bucket="plot-photos" alt="Plot photo" className="w-100 rounded-fl-xl object-fit-cover fl-swap" style={{ height: 'clamp(240px, 40vw, 420px)' }} />
      {photos.length > 1 && (
        <div className="d-flex gap-2 mt-2 overflow-auto pb-1">
          {photos.map((p, n) => (
            <button key={p.id} type="button" className={`p-0 border-0 rounded-3 overflow-hidden flex-none ${n === i ? 'outline-lime' : 'opacity-75'}`} style={{ outline: n === i ? '3px solid var(--fl-lime)' : 'none' }} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`}>
              <Photo path={p.storage_path} bucket="plot-photos" className="object-fit-cover d-block" style={{ width: 84, height: 60 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ApplyPanel({ plot, existing, onApplied }) {
  const [form, setForm] = useState({ planned_crop: plot.suitable_crops?.[0] || '', proposed_duration_months: plot.min_duration_months || 6, message: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { profile } = useAuth()

  if (existing) {
    return (
      <div className="fl-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-2"><h2 className="h5 mb-0">Your application</h2><StatusBadge map={APPLICATION_STATUS} value={existing.status} /></div>
        <p className="small text-muted-fl">Sent {timeAgo(existing.created_at)} for {existing.planned_crop}.</p>
        <Link to={`/applications/${existing.id}`} className="btn btn-primary w-100"><i className="bi bi-chat-dots me-1" />Open application and chat</Link>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.from('applications').insert({
      plot_id: plot.id, farmer_id: profile.id, planned_crop: form.planned_crop,
      proposed_duration_months: Number(form.proposed_duration_months) || null, message: form.message || null,
    }).select().single()
    setBusy(false)
    if (err) return setError(errorMessage(err))
    onApplied(data)
  }

  return (
    <form className="fl-card p-4" onSubmit={submit}>
      <h2 className="h5">Apply for this plot</h2>
      <p className="small text-muted-fl">{profile.is_group ? `Applying as ${profile.group_name} (${profile.group_size} members).` : 'The landowner will see your profile and message.'}</p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="d-grid gap-3">
        <Field label="Crop you plan to grow" htmlFor="ap-crop">
          <input id="ap-crop" className="form-control" list="ap-crops" required value={form.planned_crop} onChange={(e) => setForm({ ...form, planned_crop: e.target.value })} />
          <datalist id="ap-crops">{CROPS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="How long (months)" htmlFor="ap-dur"><input id="ap-dur" type="number" min="1" max="120" className="form-control" value={form.proposed_duration_months} onChange={(e) => setForm({ ...form, proposed_duration_months: e.target.value })} /></Field>
        <Field label="Message to the landowner" htmlFor="ap-msg" hint="Your experience and what you can bring (seed, labour, tools)."><textarea id="ap-msg" className="form-control" rows={4} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
        <button className="btn btn-primary btn-lg" disabled={busy || !form.planned_crop}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Send application</button>
      </div>
    </form>
  )
}

export default function PlotDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, role } = useAuth()
  const [actionError, setActionError] = useState('')

  const { data, loading, error, reload, setData } = useQuery(async () => {
    const { data: plot, error: err } = await supabase.from('plots')
      .select('*, plot_photos(*), owner:profiles!plots_owner_id_fkey(id, full_name, region, district, avatar_url, bio, created_at)')
      .eq('id', id).maybeSingle()
    if (err) throw err
    if (!plot) return { plot: null }
    const [verifs, myApp, apps, stats] = await Promise.all([
      supabase.from('plot_verifications').select('*, verifier:profiles!plot_verifications_verifier_id_fkey(full_name)').eq('plot_id', id).order('created_at', { ascending: false }),
      role === 'farmer' ? supabase.from('applications').select('*').eq('plot_id', id).eq('farmer_id', profile.id).in('status', ['pending', 'accepted']).maybeSingle() : { data: null },
      plot.owner_id === profile.id ? supabase.from('applications').select('id', { count: 'exact', head: true }).eq('plot_id', id).eq('status', 'pending') : { count: 0 },
      supabase.rpc('profile_stats', { p_user: plot.owner_id }),
    ])
    return { plot, verifs: verifs.data || [], myApp: myApp.data, pendingApps: apps.count || 0, ownerStats: stats.data }
  }, [id, profile.id, role])

  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  if (!data.plot) return <ErrorAlert error="This plot does not exist or is not visible to you." />

  const { plot, verifs, myApp, pendingApps, ownerStats } = data
  const isOwner = plot.owner_id === profile.id
  const photos = (plot.plot_photos || []).filter((p) => !p.is_document).sort((a, b) => a.sort_order - b.sort_order)
  const docs = (plot.plot_photos || []).filter((p) => p.is_document)

  async function setStatus(status) {
    setActionError('')
    const { error: err } = await supabase.from('plots').update({ status }).eq('id', plot.id)
    if (err) return setActionError(errorMessage(err))
    reload()
  }
  async function remove() {
    const { error: err } = await supabase.from('plots').delete().eq('id', plot.id)
    if (err) return setActionError(errorMessage(err))
    navigate('/plots', { replace: true })
  }

  return (
    <div className="fl-page">
      <button type="button" className="btn btn-link btn-sm p-0 mb-3" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(isOwner ? '/plots' : '/find'))}><i className="bi bi-arrow-left me-1" />Back</button>
      {location.state?.saved && <div className="alert alert-success">Saved. {plot.status === 'pending' && 'A verifier has been notified.'}</div>}
      <ErrorAlert error={actionError} />

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 className="h2 mb-1">{plot.title}</h1>
          <div className="text-muted-fl"><i className="bi bi-geo-alt me-1" />{[plot.community, plot.district, plot.region].filter(Boolean).join(', ')}</div>
        </div>
        <StatusBadge map={PLOT_STATUS} value={plot.status} />
      </div>

      <div className="row g-4">
        <div className="col-lg-8 d-grid gap-4 align-content-start">
          <Gallery photos={photos} />
          <section className="fl-card p-4">
            <div className="row g-3 mb-3">
              {[['bi-rulers', 'Size', `${fmtNumber(plot.size_acres)} acres`], ['bi-layers', 'Soil', plot.soil_type], ['bi-droplet', 'Water', plot.water_access],
                ['bi-calendar-event', 'Available from', plot.available_from ? fmtDate(plot.available_from) : 'Now'], ['bi-hourglass', 'Minimum', plot.min_duration_months ? `${plot.min_duration_months} months` : 'Flexible']].map(([icon, k, v]) => (
                <div className="col-6 col-md-4" key={k}>
                  <div className="d-flex gap-2"><i className={`bi ${icon} text-deep fs-5`} /><div><div className="small text-muted-fl">{k}</div><div className="fw-semibold">{v}</div></div></div>
                </div>
              ))}
            </div>
            {plot.suitable_crops?.length > 0 && <div className="d-flex flex-wrap gap-2 mb-3">{plot.suitable_crops.map((c) => <span key={c} className="fl-pill">{c}</span>)}</div>}
            {plot.description && <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{plot.description}</p>}
          </section>
          <section>
            <h2 className="h5 mb-2">Location</h2>
            <PlotMap lat={plot.latitude} lng={plot.longitude} />
          </section>
          {(isOwner || role === 'verifier' || role === 'admin') && (
            <section className="fl-card p-4">
              <h2 className="h5">Verification history</h2>
              {verifs.length === 0 ? <p className="small text-muted-fl mb-0">Not checked yet.</p> : verifs.map((v) => (
                <div key={v.id} className="d-flex gap-3 py-2 border-top">
                  <i className={`bi ${v.decision === 'approved' ? 'bi-patch-check-fill text-success' : 'bi-patch-exclamation-fill text-danger'} fs-4`} />
                  <div><div className="fw-semibold">{v.decision === 'approved' ? 'Approved' : 'Not approved'} by {v.verifier?.full_name}</div>
                    <div className="small text-muted-fl">{v.visited_on ? `Visited ${fmtDate(v.visited_on)}` : fmtDate(v.created_at)}</div>
                    {v.notes && <div className="small mt-1">{v.notes}</div>}</div>
                </div>
              ))}
              {docs.length > 0 && <div className="mt-3 small"><i className="bi bi-paperclip me-1" />{docs.length} supporting document{docs.length > 1 ? 's' : ''} attached</div>}
            </section>
          )}
        </div>

        <div className="col-lg-4 d-grid gap-4 align-content-start">
          {isOwner && (
            <div className="fl-card p-4 d-grid gap-2">
              <h2 className="h5">Manage</h2>
              {plot.status === 'pending' && <p className="small text-muted-fl mb-1">Waiting for a verifier to check the plot.</p>}
              {plot.status === 'rejected' && <p className="small text-muted-fl mb-1">Fix the details the verifier mentioned, then resubmit.</p>}
              {pendingApps > 0 && <Link to="/applications" className="btn btn-primary"><i className="bi bi-inbox me-1" />{pendingApps} application{pendingApps > 1 ? 's' : ''} to review</Link>}
              {plot.status !== 'in_deal' && <Link to={`/plots/${plot.id}/edit`} className="btn btn-outline-primary"><i className="bi bi-pencil me-1" />Edit listing</Link>}
              {['pending', 'verified', 'rejected'].includes(plot.status) && <ActionButton className="btn btn-outline-primary" confirm="Withdraw this plot? Farmers will no longer see it." onClick={() => setStatus('archived')}><i className="bi bi-eye-slash me-1" />Withdraw listing</ActionButton>}
              {['archived', 'rejected'].includes(plot.status) && <ActionButton className="btn btn-primary" onClick={() => setStatus('pending')}><i className="bi bi-arrow-repeat me-1" />Resubmit for verification</ActionButton>}
              {plot.status !== 'in_deal' && <ActionButton className="btn btn-link text-danger" confirm="Delete this plot permanently?" onClick={remove}>Delete plot</ActionButton>}
            </div>
          )}
          {role === 'farmer' && plot.status === 'verified' && (
            <ApplyPanel plot={plot} existing={myApp} onApplied={(a) => setData({ ...data, myApp: a })} />
          )}
          {(role === 'verifier' || role === 'admin') && plot.status === 'pending' && (
            <Link to={`/verify/plots/${plot.id}`} className="btn btn-primary btn-lg"><i className="bi bi-patch-check me-1" />Verify this plot</Link>
          )}

          <div className="fl-card p-4">
            <div className="small text-muted-fl mb-2">Landowner</div>
            <Link to={`/u/${plot.owner.id}`} className="d-flex align-items-center gap-3 text-decoration-none text-reset mb-2">
              <Avatar profile={plot.owner} size={48} />
              <div><div className="fw-semibold">{displayName(plot.owner)}</div><div className="small text-muted-fl">{[plot.owner.district, plot.owner.region].filter(Boolean).join(', ')}</div></div>
            </Link>
            {ownerStats && (
              <div className="d-flex gap-3 small text-muted-fl">
                <span><i className="bi bi-star-fill text-ochre me-1" />{ownerStats.rating_average ?? 'No ratings'}{ownerStats.rating_count ? ` (${ownerStats.rating_count})` : ''}</span>
                <span><i className="bi bi-trophy me-1" />{ownerStats.completed_seasons} seasons</span>
              </div>
            )}
          </div>
          <div className="alert alert-light border small mb-0"><i className="bi bi-info-circle me-1" />Verification confirms the plot exists and matches its listing. It is not proof of land title.</div>
        </div>
      </div>
    </div>
  )
}
