import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, StatusBadge, Photo } from '../../components/ui'
import { PlotCard, DealCard, PLOT_SELECT, DEAL_SELECT } from '../../components/cards'
import { APPLICATION_STATUS, OFFER_STATUS, MILESTONES } from '../../lib/constants'
import { timeAgo, displayName, fmtNumber, fmtCedis, fmtDateTime } from '../../lib/format'

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

// Dark band listing what needs the user's attention
function Attention({ items, empty }) {
  return (
    <section className="fl-band fl-on-dark fl-enter d4">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div><span className="fl-eyebrow mb-2">Needs your attention</span><h2 className="h4 mb-0">{items.length ? `${items.length} thing${items.length > 1 ? 's' : ''} to do` : 'You are all caught up'}</h2></div>
      </div>
      {items.length === 0 ? <p className="mb-0" style={{ opacity: 0.8 }}>{empty}</p> : (
        <div className="row g-3">
          {items.map((it, n) => (
            <div className="col-md-6 col-xl-4 fl-swap" key={it.key} style={{ animationDelay: `${0.35 + n * 0.07}s` }}>
              <Link to={it.to} className="fl-card-dark d-flex gap-3 h-100">
                <span className="fl-icon-tile flex-none"><i className={`bi ${it.icon}`} /></span>
                <div className="min-w-0 flex-grow-1">
                  <div className="fw-semibold text-white">{it.title}</div>
                  <div className="small text-truncate-2" style={{ opacity: 0.8 }}>{it.text}</div>
                  <div className="small text-lime fw-semibold mt-2">{it.cta} <i className="bi bi-arrow-right" /></div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const Section = ({ title, link, linkLabel = 'See all', children }) => (
  <>
    <div className="fl-section-title"><h2>{title}</h2>{link && <Link to={link} className="small fw-semibold">{linkLabel} <i className="bi bi-arrow-right" /></Link>}</div>
    {children}
  </>
)

// Which deals are waiting on this person, and for what
async function dealTodos(deals, me) {
  const latest = {}
  for (const d of deals) {
    const top = [...(d.agreements || [])].sort((a, b) => b.version - a.version)[0]
    if (top) latest[d.id] = top
  }
  const todos = []
  for (const d of deals) {
    const mine = d.landowner_id === me ? 'landowner_confirmed_at' : 'farmer_confirmed_at'
    const title = d.plots?.title
    if (d.status === 'drafting' && !latest[d.id]) todos.push({ key: d.id, icon: 'bi-file-earmark-text', title: 'Agree the terms', text: `${title}: crop, dates, inputs and the harvest split.`, to: `/deals/${d.id}?tab=agreement`, cta: 'Start agreement' })
    else if (d.status === 'drafting' && !latest[d.id][mine]) todos.push({ key: d.id, icon: 'bi-file-earmark-check', title: 'Terms to confirm', text: `Version ${latest[d.id].version} for ${title} is waiting for you.`, to: `/deals/${d.id}?tab=agreement`, cta: 'Review terms' })
    else if (d.status === 'harvested' && d.landowner_id === me) todos.push({ key: d.id, icon: 'bi-basket', title: 'Confirm your share', text: `The harvest on ${title} is recorded.`, to: `/deals/${d.id}?tab=harvest`, cta: 'Confirm share' })
    else if (d.status === 'active' && d.farmer_id === me) {
      const done = new Set((d.season_milestones || []).map((m) => m.milestone))
      const next = MILESTONES.find((m) => !done.has(m.key))
      todos.push(next
        ? { key: d.id, icon: next.icon, title: `Post “${next.label}”`, text: `Next season update for ${title}, with a photo.`, to: `/deals/${d.id}?tab=season`, cta: 'Post update' }
        : { key: d.id, icon: 'bi-basket', title: 'Record the harvest', text: `All milestones are in for ${title}.`, to: `/deals/${d.id}?tab=harvest`, cta: 'Record harvest' })
    }
  }
  return todos
}

export function LandownerHome({ profile }) {
  const me = profile.id
  const { data, loading, error, reload } = useQuery(async () => {
    const [plots, apps, deals] = await Promise.all([
      supabase.from('plots').select(PLOT_SELECT).eq('owner_id', me).order('created_at', { ascending: false }),
      supabase.from('applications').select('id, planned_crop, created_at, plots!inner(title, owner_id), farmer:profiles!applications_farmer_id_fkey(id, full_name, is_group, group_name, group_size, avatar_url)')
        .eq('plots.owner_id', me).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('deals').select(DEAL_SELECT).eq('landowner_id', me).order('created_at', { ascending: false }),
    ])
    for (const r of [plots, apps, deals]) if (r.error) throw r.error
    return { plots: plots.data, apps: apps.data, deals: deals.data, todos: await dealTodos(deals.data, me) }
  }, [me])

  const live = (data?.deals || []).filter((d) => ['drafting', 'active', 'harvested'].includes(d.status))
  const todos = data ? [
    ...data.apps.map((a) => ({ key: a.id, icon: 'bi-person-plus', title: `${displayName(a.farmer)} applied`, text: `${a.planned_crop} on ${a.plots.title}${a.farmer.is_group ? ` · group of ${a.farmer.group_size}` : ''} · ${timeAgo(a.created_at)}`, to: `/applications/${a.id}`, cta: 'Review applicant' })),
    ...data.todos,
    ...data.plots.filter((p) => p.status === 'rejected').map((p) => ({ key: p.id, icon: 'bi-patch-exclamation', title: 'Plot sent back', text: `${p.title} needs a correction before it can be verified.`, to: `/plots/${p.id}`, cta: 'Fix and resubmit' })),
  ] : []

  return (
    <div className="fl-page">
      <PageHeader image="/images/hero-pineapple-farm.webp" tall eyebrow={today()} title={`${greeting()}, ${profile.full_name.split(' ')[0]}.`} accent="Your land is working."
        text="Plots, applicants and seasons in one place. Every term you agree is on record."
        actions={<><Link to="/plots/new" className="btn btn-lime btn-lg btn-arrow">List a plot <span className="fl-arrow"><i className="bi bi-plus-lg" /></span></Link></>}
        stats={data && [
          { icon: 'bi-geo-alt', label: 'Plots listed', value: data.plots.length, to: '/plots' },
          { icon: 'bi-patch-check', label: 'Verified & open', value: data.plots.filter((p) => p.status === 'verified').length, to: '/plots' },
          { icon: 'bi-inbox', label: 'Applications', value: data.apps.length, to: '/applications', highlight: data.apps.length > 0 },
          { icon: 'bi-flower2', label: 'Running deals', value: live.length, to: '/deals' },
        ]} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <>
          <Attention items={todos} empty="New applications, terms to confirm and harvests to check will show up here." />
          {live.length > 0 && (
            <Section title="Your seasons" link="/deals">
              <div className="row g-3">{live.map((d) => <div className="col-sm-6 col-xl-4" key={d.id}><DealCard deal={d} me={me} /></div>)}</div>
            </Section>
          )}
          <Section title="Your plots" link="/plots" linkLabel="Manage plots">
            <div className="row g-3">
              {data.plots.slice(0, 5).map((p) => <div className="col-sm-6 col-xl-4" key={p.id}><PlotCard plot={p} to={`/plots/${p.id}`} /></div>)}
              <div className="col-sm-6 col-xl-4"><Link to="/plots/new" className="fl-add-card"><span className="text-center"><span className="fl-icon-tile mb-2"><i className="bi bi-plus-lg" /></span><span className="d-block">List another plot</span><span className="d-block small fw-normal text-muted-fl">A verifier checks it before farmers see it</span></span></Link></div>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export function FarmerHome({ profile }) {
  const me = profile.id
  const { data, loading, error, reload } = useQuery(async () => {
    let suggested = supabase.from('plots').select(PLOT_SELECT).eq('status', 'verified').order('created_at', { ascending: false }).limit(3)
    if (profile.region) suggested = suggested.eq('region', profile.region)
    const [plots, apps, deals, sessions, groups, unread] = await Promise.all([
      suggested,
      supabase.from('applications').select('id, status, planned_crop, created_at, plots(title)').eq('farmer_id', me).order('created_at', { ascending: false }),
      supabase.from('deals').select(DEAL_SELECT).eq('farmer_id', me).order('created_at', { ascending: false }),
      supabase.from('sessions').select('id, title, starts_at, topic, host:profiles!sessions_host_id_fkey(full_name)').gte('starts_at', new Date().toISOString()).order('starts_at').limit(3),
      supabase.from('group_members').select('groups(id, name, region, crop)').eq('user_id', me),
      supabase.rpc('group_unread_counts'),
    ])
    for (const r of [plots, apps, deals]) if (r.error) throw r.error
    return { plots: plots.data, apps: apps.data, deals: deals.data, sessions: sessions.data || [], groups: (groups.data || []).map((g) => g.groups), groupUnread: (unread.data || []).reduce((a, r) => a + r.unread, 0), todos: await dealTodos(deals.data, me) }
  }, [me, profile.region])

  const live = (data?.deals || []).filter((d) => ['drafting', 'active', 'harvested'].includes(d.status))
  const name = profile.is_group ? profile.group_name : profile.full_name.split(' ')[0]

  return (
    <div className="fl-page">
      <PageHeader image="/images/hero-farmer-maize.webp" imagePosition="center 12%" tall eyebrow={today()} title={`${greeting()}, ${name}.`} accent="Let’s grow something."
        text={profile.is_group ? `Farming together as a group of ${profile.group_size}.` : 'Find verified land, agree clear terms, and keep your season on record.'}
        actions={<Link to="/find" className="btn btn-lime btn-lg btn-arrow">Find land <span className="fl-arrow"><i className="bi bi-search" /></span></Link>}
        stats={data && [
          { icon: 'bi-send', label: 'Applications pending', value: data.apps.filter((a) => a.status === 'pending').length, to: '/applications' },
          { icon: 'bi-flower2', label: 'Seasons running', value: live.length, to: '/deals', highlight: live.length > 0 },
          { icon: 'bi-trophy', label: 'Seasons completed', value: data.deals.filter((d) => d.status === 'completed').length, to: '/deals' },
          { icon: 'bi-people', label: 'Groups', value: data.groups.length, to: '/groups' },
        ]} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <>
          <Attention items={data.todos} empty="When a landowner accepts your application, the next steps for your season show up here." />
          {live.length > 0 && (
            <Section title="Your seasons" link="/deals">
              <div className="row g-3">{live.map((d) => <div className="col-sm-6 col-xl-4" key={d.id}><DealCard deal={d} me={me} /></div>)}</div>
            </Section>
          )}
          <Section title={profile.region ? `New land in ${profile.region}` : 'New verified land'} link="/find" linkLabel="Search all land">
            {data.plots.length === 0 ? <div className="fl-card p-4 text-muted-fl">No verified plots here yet. Try searching other regions.</div> : (
              <div className="row g-3">{data.plots.map((p) => <div className="col-sm-6 col-xl-4" key={p.id}><PlotCard plot={p} to={`/find/${p.id}`} showStatus={false} /></div>)}</div>
            )}
          </Section>
          <div className="row g-4 mt-1">
            <div className="col-lg-7">
              <Section title="Learn this week" link="/sessions">
                <div className="fl-card p-2 h-auto">
                  {data.sessions.length === 0 ? <p className="small text-muted-fl p-3 mb-0">No sessions scheduled yet.</p> : data.sessions.map((s) => {
                    const d = new Date(s.starts_at)
                    return (
                      <Link key={s.id} to={`/sessions/${s.id}`} className="fl-list-item">
                        <div className="text-center flex-none rounded-4 py-2" style={{ width: 58, background: '#E8F3D2' }}>
                          <div className="small fw-semibold text-deep text-uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                          <div className="fs-5 fw-semibold lh-1" style={{ fontFamily: 'Outfit' }}>{d.getDate()}</div>
                        </div>
                        <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{s.title}</div><div className="small text-muted-fl">{fmtDateTime(s.starts_at)} · {s.host?.full_name}</div></div>
                        <i className="bi bi-chevron-right text-muted-fl" />
                      </Link>
                    )
                  })}
                </div>
              </Section>
            </div>
            <div className="col-lg-5">
              <Section title="Your groups" link="/groups">
                <Link to="/groups" className="fl-img-card" style={{ minHeight: 230 }}>
                  <img src="/images/sm/farmers-weeding.webp" alt="" loading="lazy" />
                  <span className="fl-card-arrow" aria-hidden="true"><i className="bi bi-arrow-up-right" /></span>
                  {data.groupUnread > 0 && <span className="fl-unread-badge" style={{ top: '1rem', right: '1rem' }}>{data.groupUnread > 99 ? '99+' : data.groupUnread} new</span>}
                  <div className="fl-img-card-body pe-5">
                    {data.groups.length ? (
                      <><h3 className="h5 mb-1">{data.groups.map((g) => g.name).join(', ')}</h3><div className="small" style={{ opacity: 0.85 }}>Labour days, shared inputs and the notice board.</div></>
                    ) : (
                      <><h3 className="h5 mb-1">Farm together, like nnoboa</h3><div className="small" style={{ opacity: 0.85 }}>Join a group for your crop or region.</div></>
                    )}
                  </div>
                </Link>
              </Section>
            </div>
          </div>
          {data.apps.length > 0 && (
            <Section title="Your applications" link="/applications">
              <div className="fl-card p-2">
                {data.apps.slice(0, 4).map((a) => (
                  <Link key={a.id} to={`/applications/${a.id}`} className="fl-list-item">
                    <span className="fl-icon-tile soft flex-none"><i className="bi bi-send" /></span>
                    <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{a.plots?.title}</div><div className="small text-muted-fl">{a.planned_crop} · {timeAgo(a.created_at)}</div></div>
                    <StatusBadge map={APPLICATION_STATUS} value={a.status} />
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

export function BuyerHome({ profile }) {
  const me = profile.id
  const { data, loading, error, reload } = useQuery(async () => {
    const [listings, offers] = await Promise.all([
      supabase.from('produce_listings').select('*, seller:profiles!produce_listings_seller_id_fkey(full_name, is_group, group_name)').eq('status', 'open').order('created_at', { ascending: false }).limit(6),
      supabase.from('offers').select('*, produce_listings(id, crop, unit)').eq('buyer_id', me).order('created_at', { ascending: false }),
    ])
    for (const r of [listings, offers]) if (r.error) throw r.error
    return { listings: listings.data, offers: offers.data }
  }, [me])

  return (
    <div className="fl-page">
      <PageHeader image="/images/market-okro-seller.webp" tall eyebrow={today()} title={`${greeting()}, ${profile.full_name.split(' ')[0]}.`} accent="Fresh from the farm."
        text="Buy directly from FarmLink farmers and groups. Payment and collection happen between you and the seller."
        actions={<Link to="/market" className="btn btn-lime btn-lg btn-arrow">Browse produce <span className="fl-arrow"><i className="bi bi-basket" /></span></Link>}
        stats={data && [
          { icon: 'bi-basket', label: 'Listings open', value: data.listings.length, to: '/market' },
          { icon: 'bi-hourglass', label: 'Offers pending', value: data.offers.filter((o) => o.status === 'pending').length, to: '/market/offers' },
          { icon: 'bi-bag-check', label: 'Offers accepted', value: data.offers.filter((o) => o.status === 'accepted').length, to: '/market/offers', highlight: data.offers.some((o) => o.status === 'accepted') },
        ]} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <>
          <Section title="Fresh produce" link="/market" linkLabel="Marketplace">
            <div className="row g-3">
              {data.listings.map((l) => (
                <div className="col-sm-6 col-xl-4" key={l.id}>
                  <Link to={`/market/listings/${l.id}`} className="fl-img-card fl-photo-card">
                    <Photo path={l.photo_path} bucket="produce-photos" className="fl-photo-fill" size="sm" />
                    <span className="fl-card-arrow" aria-hidden="true"><i className="bi bi-arrow-up-right" /></span>
                    <div className="fl-img-card-body pe-5">
                      <span className="fl-pill lime mb-2">{l.price_per_unit != null ? `${fmtCedis(l.price_per_unit)} / ${l.unit.replace(/s$/, '')}` : 'Open to offers'}</span>
                      <h3 className="h5 mb-1">{l.crop}</h3>
                      <div className="small" style={{ opacity: 0.85 }}>{fmtNumber(l.quantity)} {l.unit} · {l.region} · {displayName(l.seller)}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </Section>
          {data.offers.length > 0 && (
            <Section title="Your offers" link="/market/offers">
              <div className="fl-card p-2">
                {data.offers.slice(0, 5).map((o) => (
                  <Link key={o.id} to={`/market/listings/${o.produce_listings?.id}`} className="fl-list-item">
                    <span className="fl-icon-tile soft flex-none"><i className="bi bi-tag" /></span>
                    <div className="flex-grow-1"><div className="fw-semibold">{o.produce_listings?.crop}</div><div className="small text-muted-fl">{fmtNumber(o.quantity)} {o.produce_listings?.unit} at {fmtCedis(o.price_per_unit)}</div></div>
                    <StatusBadge map={OFFER_STATUS} value={o.status} />
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}


