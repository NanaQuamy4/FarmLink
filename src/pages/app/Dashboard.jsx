import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import { PageHeader, StatCard, Loading, ErrorAlert, EmptyState, StatusBadge, Avatar } from '../../components/ui'
import { PlotCard, DealRow, PLOT_SELECT, DEAL_SELECT } from '../../components/cards'
import { PLOT_STATUS, APPLICATION_STATUS, DISPUTE_STATUS, OFFER_STATUS } from '../../lib/constants'
import { fmtDateTime, timeAgo, displayName, fmtNumber, fmtCedis } from '../../lib/format'
import AdminOverview from './admin/AdminOverview'

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

function LandownerDashboard({ me }) {
  const { data, loading, error, reload } = useQuery(async () => {
    const [plots, apps, deals] = await Promise.all([
      supabase.from('plots').select(PLOT_SELECT).eq('owner_id', me).order('created_at', { ascending: false }),
      supabase.from('applications').select('id, planned_crop, created_at, status, plots!inner(title, owner_id), farmer:profiles!applications_farmer_id_fkey(id, full_name, is_group, group_name, group_size, avatar_url)')
        .eq('plots.owner_id', me).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('deals').select(DEAL_SELECT).eq('landowner_id', me).order('created_at', { ascending: false }),
    ])
    for (const r of [plots, apps, deals]) if (r.error) throw r.error
    return { plots: plots.data, apps: apps.data, deals: deals.data }
  }, [me])
  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { plots, apps, deals } = data
  const live = deals.filter((d) => ['drafting', 'active', 'harvested'].includes(d.status))

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="bi-geo-alt" label="Plots listed" value={plots.length} to="/plots" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-patch-check" label="Verified & available" value={plots.filter((p) => p.status === 'verified').length} to="/plots" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-inbox" label="Applications to review" value={apps.length} to="/applications" tone={apps.length ? 'dark' : undefined} /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-file-earmark-check" label="Running deals" value={live.length} to="/deals" /></div>
      </div>
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <Panel title="Applications waiting for you" link="/applications">
            {apps.length === 0 ? <p className="text-muted-fl small mb-0 py-3">No new applications. Verified plots appear in farmers’ searches.</p> : apps.slice(0, 4).map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`} className="fl-list-item">
                <Avatar profile={a.farmer} size={42} />
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold text-truncate">{displayName(a.farmer)}{a.farmer?.is_group && <span className="small text-muted-fl"> · {a.farmer.group_size} members</span>}</div>
                  <div className="small text-muted-fl text-truncate">{a.planned_crop} on {a.plots.title} · {timeAgo(a.created_at)}</div>
                </div>
                <i className="bi bi-chevron-right text-muted-fl" />
              </Link>
            ))}
          </Panel>
          <Panel title="Your deals" link="/deals">
            {live.length === 0 ? <p className="text-muted-fl small mb-0 py-3">When you accept an application, the deal appears here.</p> : live.map((d) => <DealRow key={d.id} deal={d} me={me} />)}
          </Panel>
        </div>
        <div className="col-lg-5">
          <Panel title="Your plots" link="/plots" linkLabel="Manage">
            {plots.length === 0 ? (
              <EmptyState icon="bi-geo-alt" title="List your first plot" text="Add photos, size, soil and water. A verifier checks it before farmers see it." action={<Link to="/plots/new" className="btn btn-primary">List a plot</Link>} />
            ) : (
              <div className="d-grid gap-1">
                {plots.slice(0, 5).map((p) => (
                  <Link key={p.id} to={`/plots/${p.id}`} className="fl-list-item">
                    <span className="fl-icon-tile soft flex-none"><i className="bi bi-geo-alt" /></span>
                    <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{p.title}</div><div className="small text-muted-fl">{fmtNumber(p.size_acres)} acres · {p.district || p.region}</div></div>
                    <StatusBadge map={PLOT_STATUS} value={p.status} />
                  </Link>
                ))}
                <Link to="/plots/new" className="btn btn-outline-primary mt-2"><i className="bi bi-plus-lg me-1" />List another plot</Link>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

function FarmerDashboard({ me, profile }) {
  const { data, loading, error, reload } = useQuery(async () => {
    let suggested = supabase.from('plots').select(PLOT_SELECT).eq('status', 'verified').order('created_at', { ascending: false }).limit(3)
    if (profile.region) suggested = suggested.eq('region', profile.region)
    const [plots, apps, deals] = await Promise.all([
      suggested,
      supabase.from('applications').select('id, status, planned_crop, created_at, plots(title)').eq('farmer_id', me).order('created_at', { ascending: false }),
      supabase.from('deals').select(DEAL_SELECT).eq('farmer_id', me).order('created_at', { ascending: false }),
    ])
    for (const r of [plots, apps, deals]) if (r.error) throw r.error
    return { plots: plots.data, apps: apps.data, deals: deals.data }
  }, [me, profile.region])
  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { plots, apps, deals } = data
  const live = deals.filter((d) => ['drafting', 'active', 'harvested'].includes(d.status))

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="bi-send" label="Applications pending" value={apps.filter((a) => a.status === 'pending').length} to="/applications" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-flower2" label="Seasons running" value={live.length} to="/deals" tone={live.length ? 'dark' : undefined} /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-trophy" label="Seasons completed" value={deals.filter((d) => d.status === 'completed').length} to="/deals" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-search" label="Find land" value={<i className="bi bi-arrow-right" />} to="/find" /></div>
      </div>
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <Panel title="Your seasons" link="/deals">
            {live.length === 0 ? <p className="text-muted-fl small mb-0 py-3">Once a landowner accepts your application, your season appears here.</p> : live.map((d) => <DealRow key={d.id} deal={d} me={me} />)}
          </Panel>
          <Panel title="Your applications" link="/applications">
            {apps.length === 0 ? <p className="text-muted-fl small mb-0 py-3">You have not applied for a plot yet.</p> : apps.slice(0, 4).map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`} className="fl-list-item">
                <span className="fl-icon-tile soft flex-none"><i className="bi bi-send" /></span>
                <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{a.plots?.title}</div><div className="small text-muted-fl">{a.planned_crop} · {timeAgo(a.created_at)}</div></div>
                <StatusBadge map={APPLICATION_STATUS} value={a.status} />
              </Link>
            ))}
          </Panel>
        </div>
        <div className="col-lg-5">
          <Panel title={profile.region ? `New plots in ${profile.region}` : 'New verified plots'} link="/find" linkLabel="Search all">
            {plots.length === 0 ? <p className="text-muted-fl small mb-0 py-3">No verified plots here yet. Try searching other regions.</p> : (
              <div className="d-grid gap-3 pt-2">{plots.map((p) => <PlotCard key={p.id} plot={p} to={`/find/${p.id}`} showStatus={false} />)}</div>
            )}
          </Panel>
        </div>
      </div>
    </>
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

function BuyerDashboard({ me }) {
  const { data, loading, error, reload } = useQuery(async () => {
    const [listings, offers] = await Promise.all([
      supabase.from('produce_listings').select('*, seller:profiles!produce_listings_seller_id_fkey(full_name, is_group, group_name)').eq('status', 'open').order('created_at', { ascending: false }).limit(6),
      supabase.from('offers').select('*, produce_listings(crop, unit)').eq('buyer_id', me).order('created_at', { ascending: false }),
    ])
    for (const r of [listings, offers]) if (r.error) throw r.error
    return { listings: listings.data, offers: offers.data }
  }, [me])
  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { listings, offers } = data
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <Panel title="Fresh produce" link="/market" linkLabel="Marketplace">
          {listings.length === 0 ? <p className="text-muted-fl small py-3 mb-0">No produce listed right now.</p> : listings.map((l) => (
            <Link key={l.id} to={`/market/listings/${l.id}`} className="fl-list-item">
              <span className="fl-icon-tile soft flex-none"><i className="bi bi-basket" /></span>
              <div className="flex-grow-1 min-w-0"><div className="fw-semibold">{l.crop} · {fmtNumber(l.quantity)} {l.unit}</div><div className="small text-muted-fl">{displayName(l.seller)} · {l.region}</div></div>
              <span className="fw-semibold text-deep">{fmtCedis(l.price_per_unit)}</span>
            </Link>
          ))}
        </Panel>
      </div>
      <div className="col-lg-5">
        <Panel title="Your offers" link="/market/offers">
          {offers.length === 0 ? <p className="text-muted-fl small py-3 mb-0">Offers you make appear here.</p> : offers.slice(0, 6).map((o) => (
            <div key={o.id} className="fl-list-item">
              <div className="flex-grow-1"><div className="fw-semibold">{o.produce_listings?.crop}</div><div className="small text-muted-fl">{fmtNumber(o.quantity)} {o.produce_listings?.unit} at {fmtCedis(o.price_per_unit)}</div></div>
              <StatusBadge map={OFFER_STATUS} value={o.status} />
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, role } = useAuth()
  const me = profile.id
  const intro = {
    landowner: 'Here is what is happening on your land.',
    farmer: 'Here is how your seasons and applications are going.',
    verifier: 'Plots and disputes in your regions.',
    admin: 'Platform overview.',
    buyer: 'Produce from FarmLink farmers.',
  }[role]

  return (
    <div className="fl-page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${profile.full_name.split(' ')[0]}`}
        text={intro}
        actions={role === 'landowner' ? <Link to="/plots/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />List a plot</Link>
          : role === 'farmer' ? <Link to="/find" className="btn btn-primary"><i className="bi bi-search me-1" />Find land</Link> : null}
      />
      {role === 'landowner' && <LandownerDashboard me={me} />}
      {role === 'farmer' && <FarmerDashboard me={me} profile={profile} />}
      {role === 'verifier' && <VerifierDashboard me={me} />}
      {role === 'admin' && <AdminOverview />}
      {role === 'buyer' && <BuyerDashboard me={me} />}
    </div>
  )
}
