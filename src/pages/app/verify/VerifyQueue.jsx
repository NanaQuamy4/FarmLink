import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, Photo } from '../../../components/ui'
import { PLOT_SELECT, coverPhoto } from '../../../components/cards'
import { fmtNumber, timeAgo, displayName } from '../../../lib/format'

export default function VerifyQueue() {
  const { profile, role } = useAuth()
  const [mine, setMine] = useState(false)
  const { data, loading, error, reload } = useQuery(async () => {
    const [plots, me] = await Promise.all([
      supabase.from('plots').select(`${PLOT_SELECT}, owner:profiles!plots_owner_id_fkey(full_name, is_group, group_name)`).eq('status', 'pending').order('created_at'),
      role === 'verifier' ? supabase.from('verifiers').select('regions, verifier_type').eq('id', profile.id).maybeSingle() : { data: null },
    ])
    if (plots.error) throw plots.error
    return { plots: plots.data, me: me.data }
  }, [profile.id, role])

  const shown = (data?.plots || []).filter((p) => !mine || p.assigned_verifier_id === profile.id)

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Verifier" title="Verification queue"
        text={data?.me ? `Plots waiting for a check in ${data.me.regions.join(', ')}.` : 'Plots waiting for a check.'} />
      <div className="form-check form-switch mb-3">
        <input className="form-check-input" type="checkbox" id="vq-mine" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        <label className="form-check-label" htmlFor="vq-mine">Only plots assigned to me</label>
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : shown.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-patch-check" title="All caught up" text="New plots in your regions will appear here, and you will get a notification." /></div>
      ) : (
        <div className="fl-card p-2">
          {shown.map((p) => (
            <Link key={p.id} to={`/verify/plots/${p.id}`} className="fl-list-item">
              <Photo path={coverPhoto(p)} bucket="plot-photos" className="rounded-3 object-fit-cover flex-none" style={{ width: 72, height: 56 }} />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{p.title}</div>
                <div className="small text-muted-fl">{fmtNumber(p.size_acres)} acres · {[p.community, p.district, p.region].filter(Boolean).join(', ')}</div>
                <div className="small text-muted-fl">by {displayName(p.owner)} · listed {timeAgo(p.created_at)}</div>
              </div>
              {p.assigned_verifier_id === profile.id && <span className="fl-pill lime d-none d-sm-inline-flex" style={{ fontSize: '.72rem' }}>Assigned to you</span>}
              {!p.assigned_verifier_id && <span className="fl-status pending d-none d-sm-inline-flex">No verifier</span>}
              <i className="bi bi-chevron-right text-muted-fl" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
