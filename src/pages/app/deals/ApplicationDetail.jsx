import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { Loading, ErrorAlert, StatusBadge, Avatar, ActionButton } from '../../../components/ui'
import ChatThread from '../../../components/ChatThread'
import { APPLICATION_STATUS } from '../../../lib/constants'
import { fmtDate, displayName } from '../../../lib/format'
import { APP_SELECT } from './Applications'

export default function ApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const { data: app, error: e } = await supabase.from('applications').select(APP_SELECT).eq('id', id).maybeSingle()
    if (e) throw e
    if (!app) throw new Error('Application not found.')
    const [deal, stats] = await Promise.all([
      supabase.from('deals').select('id, status').eq('application_id', id).maybeSingle(),
      supabase.rpc('profile_stats', { p_user: app.farmer_id }),
    ])
    return { app, deal: deal.data, stats: stats.data }
  }, [id])

  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { app, deal, stats } = data
  const isLandowner = app.plots.owner_id === profile.id
  const isFarmer = app.farmer_id === profile.id
  const other = isLandowner ? app.farmer : app.plots.owner

  async function respond(accept) {
    setErr('')
    const { data: dealId, error: e } = await supabase.rpc('respond_to_application', { p_application: id, p_accept: accept })
    if (e) return setErr(errorMessage(e))
    if (accept && dealId) navigate(`/deals/${dealId}`, { replace: true })
    else reload()
  }
  async function withdraw() {
    const { error: e } = await supabase.rpc('withdraw_application', { p_application: id })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <Link to="/applications" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Applications</Link>
      <ErrorAlert error={err} />
      <div className="row g-4">
        <div className="col-lg-5 d-grid gap-4 align-content-start">
          <section className="fl-card p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div><div className="small text-muted-fl">Application for</div><Link to={isLandowner ? `/plots/${app.plots.id}` : `/find/${app.plots.id}`} className="h5 d-block mb-0">{app.plots.title}</Link></div>
              <StatusBadge map={APPLICATION_STATUS} value={app.status} />
            </div>
            <div className="d-flex align-items-center gap-3 mb-3">
              <Avatar profile={app.farmer} size={52} />
              <div>
                <Link to={`/u/${app.farmer.id}`} className="fw-semibold text-reset">{displayName(app.farmer)}</Link>
                <div className="small text-muted-fl">{app.farmer.is_group ? `Farmer group · ${app.farmer.group_size} members` : 'Farmer'}{app.farmer.region && ` · ${app.farmer.region}`}</div>
                {stats && <div className="small text-muted-fl"><i className="bi bi-star-fill text-ochre me-1" />{stats.rating_average ?? 'New'} · {stats.completed_seasons} seasons · {stats.sessions_attended} sessions</div>}
              </div>
            </div>
            <table className="table table-sm small mb-3"><tbody>
              <tr><td className="text-muted-fl ps-0">Crop</td><td className="fw-semibold">{app.planned_crop}</td></tr>
              <tr><td className="text-muted-fl ps-0">Duration</td><td className="fw-semibold">{app.proposed_duration_months ? `${app.proposed_duration_months} months` : 'Not stated'}</td></tr>
              <tr><td className="text-muted-fl ps-0">Applied</td><td className="fw-semibold">{fmtDate(app.created_at)}</td></tr>
            </tbody></table>
            {app.message && <blockquote className="border-start border-3 ps-3 mb-0" style={{ borderColor: 'var(--fl-lime) !important' }}>{app.message}</blockquote>}
            {app.farmer.bio && <p className="small text-muted-fl mt-3 mb-0">{app.farmer.bio}</p>}
          </section>

          {deal && (
            <Link to={`/deals/${deal.id}`} className="btn btn-primary btn-lg"><i className="bi bi-file-earmark-check me-1" />Open the deal</Link>
          )}
          {isLandowner && app.status === 'pending' && (
            <section className="fl-card p-4 d-grid gap-2">
              <h2 className="h6 mb-1">Your decision</h2>
              <p className="small text-muted-fl">Accepting opens a deal and declines the other applicants for this plot. You will agree the terms next.</p>
              <ActionButton className="btn btn-primary btn-lg" confirm={`Accept ${displayName(app.farmer)} for ${app.plots.title}?`} onClick={() => respond(true)}><i className="bi bi-check2-circle me-1" />Accept applicant</ActionButton>
              <ActionButton className="btn btn-outline-danger" confirm="Decline this application?" onClick={() => respond(false)}>Decline</ActionButton>
            </section>
          )}
          {isFarmer && app.status === 'pending' && (
            <ActionButton className="btn btn-outline-danger" confirm="Withdraw your application?" onClick={withdraw}>Withdraw application</ActionButton>
          )}
        </div>

        <div className="col-lg-7">
          <section className="fl-card p-0 overflow-hidden">
            <div className="d-flex align-items-center gap-2 p-3 border-bottom">
              <Avatar profile={other} size={36} />
              <div className="flex-grow-1"><div className="fw-semibold">{displayName(other)}</div><div className="small text-muted-fl"><i className="bi bi-lock-fill me-1" />Private conversation</div></div>
            </div>
            <ChatThread applicationId={id} canSend={['pending', 'accepted'].includes(app.status)} />
          </section>
        </div>
      </div>
    </div>
  )
}
