import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useQuery } from '../../../lib/useQuery'
import { StatCard, Loading, ErrorAlert } from '../../../components/ui'
import { ROLE_LABELS, PLOT_STATUS, DEAL_STATUS } from '../../../lib/constants'
import { fmtNumber } from '../../../lib/format'

const sum = (o = {}) => Object.values(o).reduce((a, b) => a + Number(b), 0)

// Horizontal bars for a {label: count} object
export function BarList({ data, labels = {} }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  if (!entries.length) return <p className="small text-muted-fl mb-0">No data yet.</p>
  return (
    <div className="d-grid gap-2">
      {entries.map(([k, v], i) => (
        <div key={k}>
          <div className="d-flex justify-content-between small"><span>{labels[k]?.[0] || labels[k] || k}</span><span className="fw-semibold">{v}</span></div>
          <div className="progress" style={{ height: 8 }}><div className="progress-bar fl-grow-x" style={{ width: `${(v / max) * 100}%`, background: i % 2 ? 'var(--fl-leaf)' : 'var(--fl-deep)', animationDelay: `${i * 0.06}s` }} /></div>
        </div>
      ))}
    </div>
  )
}

// Column chart for [{month, count}]
export function MonthChart({ rows }) {
  const months = []
  const d = new Date()
  d.setDate(1)
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  const map = Object.fromEntries((rows || []).map((r) => [r.month, r.count]))
  const max = Math.max(1, ...months.map((m) => map[m] || 0))
  return (
    <div>
      <div className="fl-bar-chart" style={{ height: 140 }} role="img" aria-label="Deals started per month">
        {months.map((m, i) => (
          <span key={m} title={`${m}: ${map[m] || 0}`} style={{ height: `${Math.max(3, ((map[m] || 0) / max) * 100)}%`, animationDelay: `${i * 0.04}s`, opacity: map[m] ? 1 : 0.35 }} />
        ))}
      </div>
      <div className="d-flex justify-content-between small text-muted-fl mt-1">
        <span>{new Date(months[0] + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
        <span>{new Date(months[11] + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
      </div>
    </div>
  )
}

export default function AdminOverview() {
  const { data, loading, error, reload } = useQuery(async () => {
    const [stats, unassigned] = await Promise.all([
      supabase.rpc('admin_stats'),
      supabase.from('plots').select('id, title, region').eq('status', 'pending').is('assigned_verifier_id', null),
    ])
    if (stats.error) throw stats.error
    return { s: stats.data, unassigned: unassigned.data || [] }
  }, [])
  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { s, unassigned } = data

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="bi-people" label="Users" value={sum(s.users_by_role)} to="/admin/users" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-geo-alt" label="Plots" value={sum(s.plots_by_status)} to="/admin/plots" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-file-earmark-check" label="Deals" value={sum(s.deals_by_status)} to="/deals" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-shield-exclamation" label="Open disputes" value={(s.disputes_by_status.open || 0) + (s.disputes_by_status.in_mediation || 0)} to="/admin/disputes" tone="dark" /></div>
      </div>

      {(s.pending_verifier_requests > 0 || unassigned.length > 0) && (
        <div className="row g-3 mb-4">
          {s.pending_verifier_requests > 0 && (
            <div className="col-md-6"><Link to="/admin/verifiers" className="alert alert-warning d-flex align-items-center gap-2 mb-0 text-decoration-none"><i className="bi bi-person-badge fs-5" />{s.pending_verifier_requests} verifier request{s.pending_verifier_requests > 1 ? 's' : ''} waiting for approval</Link></div>
          )}
          {unassigned.length > 0 && (
            <div className="col-md-6"><Link to="/admin/plots" className="alert alert-warning d-flex align-items-center gap-2 mb-0 text-decoration-none"><i className="bi bi-geo-alt fs-5" />{unassigned.length} plot{unassigned.length > 1 ? 's have' : ' has'} no verifier for its region</Link></div>
          )}
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-8">
          <section className="fl-card p-4 h-100">
            <div className="d-flex justify-content-between mb-3"><h2 className="h5 mb-0">Deals started per month</h2><Link to="/admin/reports" className="small">Reports & export</Link></div>
            <MonthChart rows={s.deals_per_month} />
          </section>
        </div>
        <div className="col-lg-4">
          <section className="fl-card p-4 h-100">
            <h2 className="h5 mb-3">Users by role</h2>
            <BarList data={s.users_by_role} labels={ROLE_LABELS} />
          </section>
        </div>
        <div className="col-md-6 col-lg-4">
          <section className="fl-card p-4 h-100"><h2 className="h5 mb-3">Plots by status</h2><BarList data={s.plots_by_status} labels={PLOT_STATUS} /></section>
        </div>
        <div className="col-md-6 col-lg-4">
          <section className="fl-card p-4 h-100"><h2 className="h5 mb-3">Deals by status</h2><BarList data={s.deals_by_status} labels={DEAL_STATUS} /></section>
        </div>
        <div className="col-lg-4">
          <section className="fl-card p-4 h-100">
            <h2 className="h5 mb-3">Harvest recorded</h2>
            {Object.keys(s.harvest_totals).length === 0 ? <p className="small text-muted-fl">No harvests yet.</p> : Object.entries(s.harvest_totals).map(([unit, total]) => (
              <div key={unit} className="d-flex justify-content-between border-bottom py-2"><span className="text-muted-fl">{unit}</span><span className="fw-semibold">{fmtNumber(total)}</span></div>
            ))}
            <h2 className="h6 mt-4 mb-2">Plots by region</h2>
            <BarList data={s.plots_by_region} />
          </section>
        </div>
      </div>
    </>
  )
}
