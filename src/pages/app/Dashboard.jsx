import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import { PageHeader, StatCard, Loading, ErrorAlert, EmptyState, StatusBadge, Avatar } from '../../components/ui'
import { PlotCard, DealRow, PLOT_SELECT, DEAL_SELECT } from '../../components/cards'
import { PLOT_STATUS, APPLICATION_STATUS, DISPUTE_STATUS, OFFER_STATUS } from '../../lib/constants'
import { fmtDateTime, timeAgo, displayName, fmtNumber, fmtCedis } from '../../lib/format'
import AdminOverview from './admin/AdminOverview'
import { LandownerHome, FarmerHome, BuyerHome } from './UserDashboards'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Panel({ title, link, linkLabel = 'See all', children }) {
  return (
    <section className="fl-card p-3 p-md-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">{title}</h2>
        {link && <Link to={link} className="small">{linkLabel}</Link>}
      </div>
      {children}
    </section>
  )
}

function VerifierDashboard({ me }) {
  const { data, loading, error, reload } = useQuery(async () => {
    const [queue, disputes, sessions] = await Promise.all([
      supabase.from('plots').select('id, title, region, district, size_acres, created_at, assigned_verifier_id').eq('status', 'pending').order('created_at'),
      supabase.from('disputes').select('id, category, status, created_at, deals(plots(title))').eq('verifier_id', me).in('status', ['open', 'in_mediation']).order('created_at'),
      supabase.from('sessions').select('id, title, starts_at').eq('host_id', me).gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).order('starts_at').limit(3),
    ])
    for (const r of [queue, disputes, sessions]) if (r.error) throw r.error
    return { queue: queue.data, disputes: disputes.data, sessions: sessions.data }
  }, [me])
  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { queue, disputes, sessions } = data
  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-4"><StatCard icon="bi-patch-check" label="Plots to check" value={queue.length} to="/verify" tone={queue.length ? 'dark' : undefined} /></div>
        <div className="col-6 col-lg-4"><StatCard icon="bi-shield-check" label="Disputes to mediate" value={disputes.length} to="/verify/disputes" /></div>
        <div className="col-12 col-lg-4"><StatCard icon="bi-camera-video" label="Upcoming sessions you host" value={sessions.length} to="/sessions" /></div>
      </div>
      <div className="row g-4">
        <div className="col-lg-6">
          <Panel title="Verification queue" link="/verify">
            {queue.length === 0 ? <p className="text-muted-fl small mb-0 py-3">All caught up. New plots in your regions will appear here.</p> : queue.slice(0, 5).map((p) => (
              <Link key={p.id} to={`/verify/plots/${p.id}`} className="fl-list-item">
                <span className="fl-icon-tile soft flex-none"><i className="bi bi-geo-alt" /></span>
                <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{p.title}</div><div className="small text-muted-fl">{fmtNumber(p.size_acres)} acres · {p.district}, {p.region} · listed {timeAgo(p.created_at)}</div></div>
                {p.assigned_verifier_id === me && <span className="fl-pill lime" style={{ fontSize: '.7rem' }}>Assigned to you</span>}
              </Link>
            ))}
          </Panel>
        </div>
        <div className="col-lg-6 d-grid gap-4 align-content-start">
          <Panel title="Disputes" link="/verify/disputes">
            {disputes.length === 0 ? <p className="text-muted-fl small mb-0 py-3">No open disputes.</p> : disputes.map((d) => (
              <Link key={d.id} to={`/verify/disputes/${d.id}`} className="fl-list-item">
                <span className="fl-icon-tile soft flex-none"><i className="bi bi-shield-exclamation" /></span>
                <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{d.deals?.plots?.title}</div><div className="small text-muted-fl">Raised {timeAgo(d.created_at)}</div></div>
                <StatusBadge map={DISPUTE_STATUS} value={d.status} />
              </Link>
            ))}
          </Panel>
          <Panel title="Your sessions" link="/sessions">
            {sessions.length === 0 ? <p className="text-muted-fl small mb-0 py-3">Host a session to reach many farmers at once.</p> : sessions.map((s) => (
              <Link key={s.id} to={`/sessions/${s.id}`} className="fl-list-item">
                <span className="fl-icon-tile soft flex-none"><i className="bi bi-camera-video" /></span>
                <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{s.title}</div><div className="small text-muted-fl">{fmtDateTime(s.starts_at)}</div></div>
              </Link>
            ))}
          </Panel>
        </div>
      </div>
    </>
  )
}

export default function Dashboard() {
  const { profile, role } = useAuth()
  if (role === 'landowner') return <LandownerHome profile={profile} />
  if (role === 'farmer') return <FarmerHome profile={profile} />
  if (role === 'buyer') return <BuyerHome profile={profile} />
  return (
    <div className="fl-page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${profile.full_name.split(' ')[0]}`}
        text={role === 'verifier' ? 'Plots and disputes in your regions.' : 'Platform overview.'}
      />
      {role === 'verifier' && <VerifierDashboard me={profile.id} />}
      {role === 'admin' && <AdminOverview />}
    </div>
  )
}
