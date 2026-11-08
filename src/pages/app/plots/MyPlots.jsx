import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../../components/ui'
import { PlotCard, PLOT_SELECT } from '../../../components/cards'
import { PLOT_STATUS } from '../../../lib/constants'

export default function MyPlots() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('all')
  const { data, loading, error, reload } = useQuery(
    () => supabase.from('plots').select(PLOT_SELECT).eq('owner_id', profile.id).order('created_at', { ascending: false }), [profile.id])
  const shown = (data || []).filter((p) => tab === 'all' || p.status === tab)
  const counts = (data || []).reduce((a, p) => ({ ...a, [p.status]: (a[p.status] || 0) + 1 }), {})

  return (
    <div className="fl-page">
      <PageHeader image="/images/corn-field.jpg" eyebrow="My plots" title="Your land," accent="on record." text="Plots are checked by a verifier before farmers can see them."
        actions={<Link to="/plots/new" className="btn btn-primary btn-lg"><i className="bi bi-plus-lg me-1" />List a plot</Link>} />
      <ErrorAlert error={error} onRetry={reload} />
      <div className="d-flex flex-wrap gap-2 mb-4" role="tablist">
        {['all', 'pending', 'verified', 'in_deal', 'rejected', 'archived'].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>
            {k === 'all' ? 'All' : PLOT_STATUS[k][0]} <span className="opacity-75">{k === 'all' ? data?.length || 0 : counts[k] || 0}</span>
          </button>
        ))}
      </div>
      {loading ? <Loading /> : shown.length === 0 ? (
        <div className="fl-card">
          <EmptyState icon="bi-geo-alt" title={tab === 'all' ? 'No plots yet' : 'Nothing here'} text="List idle land with photos, size, soil and water access."
            action={<Link to="/plots/new" className="btn btn-primary">List a plot</Link>} />
        </div>
      ) : (
        <div className="row g-3">
          {shown.map((p, i) => (
            <div className="col-sm-6 col-xl-4 fl-swap" key={p.id} style={{ animationDelay: `${i * 0.04}s` }}><PlotCard plot={p} to={`/plots/${p.id}`} /></div>
          ))}
        </div>
      )}
    </div>
  )
}
