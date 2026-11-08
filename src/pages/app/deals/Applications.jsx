import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, StatusBadge, Avatar } from '../../../components/ui'
import { APPLICATION_STATUS } from '../../../lib/constants'
import { timeAgo, displayName } from '../../../lib/format'

export const APP_SELECT = `*, plots(id, title, region, district, owner_id, status, owner:profiles!plots_owner_id_fkey(id, full_name, avatar_url)),
  farmer:profiles!applications_farmer_id_fkey(id, full_name, is_group, group_name, group_size, region, avatar_url, bio)`

// FR4: landowners review incoming applications; farmers follow their own.
export default function Applications() {
  const { profile, role } = useAuth()
  const [tab, setTab] = useState('pending')
  const { data, loading, error, reload } = useQuery(() => {
    let q = supabase.from('applications').select(APP_SELECT).order('created_at', { ascending: false })
    q = role === 'farmer' ? q.eq('farmer_id', profile.id) : q
    return q
  }, [profile.id, role])

  const rows = (data || []).filter((a) => (role === 'farmer' ? true : a.plots?.owner_id === profile.id || role === 'admin'))
  const shown = rows.filter((a) => tab === 'all' || a.status === tab)
  const byPlot = role === 'farmer' ? null : shown.reduce((acc, a) => { (acc[a.plots.title] ||= []).push(a); return acc }, {})

  return (
    <div className="fl-page">
      <PageHeader image={role === 'admin' ? undefined : '/images/farmer-basket.webp'} eyebrow={role === 'farmer' ? 'My applications' : 'Applications'} title={role === 'farmer' ? 'Your applications' : 'Who wants to farm'} accent={role === 'farmer' ? 'in one place.' : 'your land.'}
        text={role === 'farmer' ? 'Plots you have applied for.' : 'Compare applicants, chat with them, then accept one to open a deal.'}
        actions={role === 'farmer' && <Link to="/find" className="btn btn-primary"><i className="bi bi-search me-1" />Find land</Link>} />
      <div className="d-flex flex-wrap gap-2 mb-4">
        {['pending', 'accepted', 'declined', 'withdrawn', 'all'].map((k) => (
          <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>
            {k === 'all' ? 'All' : APPLICATION_STATUS[k][0]} <span className="opacity-75">{k === 'all' ? rows.length : rows.filter((a) => a.status === k).length}</span>
          </button>
        ))}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : shown.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-inbox" title="No applications here" text={role === 'farmer' ? 'Find a verified plot and apply.' : 'Applications for your verified plots will appear here.'} /></div>
      ) : role === 'farmer' ? (
        <div className="fl-card p-2">
          {shown.map((a) => (
            <Link key={a.id} to={`/applications/${a.id}`} className="fl-list-item">
              <span className="fl-icon-tile soft flex-none"><i className="bi bi-geo-alt" /></span>
              <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{a.plots?.title}</div><div className="small text-muted-fl">{a.planned_crop} · {a.plots?.district}, {a.plots?.region} · {timeAgo(a.created_at)}</div></div>
              <StatusBadge map={APPLICATION_STATUS} value={a.status} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="d-grid gap-4">
          {Object.entries(byPlot).map(([title, apps]) => (
            <section key={title} className="fl-card p-2">
              <h2 className="h6 px-3 pt-2 mb-1"><i className="bi bi-geo-alt me-1 text-deep" />{title} <span className="text-muted-fl fw-normal">· {apps.length} applicant{apps.length > 1 ? 's' : ''}</span></h2>
              {apps.map((a) => (
                <Link key={a.id} to={`/applications/${a.id}`} className="fl-list-item">
                  <Avatar profile={a.farmer} size={44} />
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold">{displayName(a.farmer)}{a.farmer?.is_group && <span className="fl-pill ms-2" style={{ fontSize: '.7rem', padding: '.05rem .5rem' }}><i className="bi bi-people" />{a.farmer.group_size}</span>}</div>
                    <div className="small text-muted-fl text-truncate">{a.planned_crop} · {a.proposed_duration_months ? `${a.proposed_duration_months} months · ` : ''}{a.message}</div>
                  </div>
                  <span className="small text-muted-fl d-none d-sm-inline">{timeAgo(a.created_at)}</span>
                  <StatusBadge map={APPLICATION_STATUS} value={a.status} />
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
