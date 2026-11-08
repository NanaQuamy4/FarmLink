import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { uploadPhoto } from '../../../lib/storage'
import { PageHeader, Loading, ErrorAlert, EmptyState, ActionButton, Field, Photo, Avatar, StatusBadge } from '../../../components/ui'
import { REGIONS, CROPS, HARVEST_UNITS, OFFER_STATUS } from '../../../lib/constants'
import { fmtNumber, fmtCedis, timeAgo, displayName } from '../../../lib/format'

const SELLER = 'seller:profiles!produce_listings_seller_id_fkey(id, full_name, is_group, group_name, avatar_url, region)'

function ListingForm({ profile, onDone }) {
  const [f, setF] = useState({ crop: '', quantity: '', unit: 'bags', price_per_unit: '', region: profile.region || '', description: '' })
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')
  async function submit() {
    setErr('')
    try {
      const photo = file ? await uploadPhoto('produce-photos', profile.id, file) : null
      const { error } = await supabase.from('produce_listings').insert({
        seller_id: profile.id, crop: f.crop, quantity: Number(f.quantity), unit: f.unit, price_per_unit: f.price_per_unit === '' ? null : Number(f.price_per_unit),
        region: f.region, description: f.description || null, photo_path: photo,
      })
      if (error) throw error
      onDone()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }
  return (
    <div className="fl-card p-4 mb-4 row g-3">
      <h2 className="h5 col-12 mb-0">List produce</h2>
      {err && <div className="col-12"><div className="alert alert-danger py-2 mb-0">{err}</div></div>}
      <Field className="col-md-4" label="Crop" htmlFor="ml-crop"><input id="ml-crop" className="form-control" list="ml-crops" value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} /><datalist id="ml-crops">{CROPS.map((c) => <option key={c} value={c} />)}</datalist></Field>
      <Field className="col-6 col-md-2" label="Quantity" htmlFor="ml-q"><input id="ml-q" type="number" min="0.1" step="0.1" className="form-control" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
      <Field className="col-6 col-md-2" label="Unit" htmlFor="ml-u"><select id="ml-u" className="form-select" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{HARVEST_UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
      <Field className="col-6 col-md-2" label="Price per unit (GH₵)" htmlFor="ml-p"><input id="ml-p" type="number" min="0" step="0.01" className="form-control" value={f.price_per_unit} onChange={(e) => setF({ ...f, price_per_unit: e.target.value })} /></Field>
      <Field className="col-6 col-md-2" label="Region" htmlFor="ml-r"><select id="ml-r" className="form-select" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}><option value="">Choose…</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field className="col-md-8" label="Description" htmlFor="ml-d"><input id="ml-d" className="form-control" placeholder="Quality, when it is ready, where to collect" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field className="col-md-4" label="Photo" htmlFor="ml-ph"><input id="ml-ph" type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files[0] || null)} /></Field>
      <div className="col-12"><ActionButton className="btn btn-primary" disabled={!f.crop || !f.quantity || !f.region} onClick={submit}>Publish listing</ActionButton></div>
    </div>
  )
}

// FR15: browse produce; farmers and landowners list their own
export function Marketplace() {
  const { profile, role } = useAuth()
  const canSell = ['farmer', 'landowner'].includes(role)
  const [creating, setCreating] = useState(false)
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useQuery(() => {
    let x = supabase.from('produce_listings').select(`*, ${SELLER}`).order('created_at', { ascending: false })
    x = mine ? x.eq('seller_id', profile.id) : x.eq('status', 'open')
    return x
  }, [mine, profile.id])
  const rows = (data || []).filter((l) => !q || [l.crop, l.region, l.description].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Marketplace" title={canSell ? 'Sell your produce' : 'Fresh produce'} text="Buyers send offers. Sellers accept or decline. Payment happens outside FarmLink."
        actions={canSell && <button type="button" className="btn btn-primary" onClick={() => setCreating(!creating)}><i className="bi bi-plus-lg me-1" />List produce</button>} />
      {creating && <ListingForm profile={profile} onDone={() => { setCreating(false); setMine(true); reload() }} />}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-4">
        <input className="form-control" style={{ maxWidth: 320 }} placeholder="Search crop or region" aria-label="Search produce" value={q} onChange={(e) => setQ(e.target.value)} />
        {canSell && <div className="btn-group"><button type="button" className={`btn btn-sm ${!mine ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMine(false)}>All produce</button><button type="button" className={`btn btn-sm ${mine ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMine(true)}>My listings</button></div>}
        {role === 'buyer' && <Link to="/market/offers" className="btn btn-sm btn-outline-primary">My offers</Link>}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-basket" title="No produce listed" text={canSell ? 'List your harvest so buyers can make offers.' : 'Check back after harvest season.'} /></div>
      ) : (
        <div className="row g-3">
          {rows.map((l) => (
            <div className="col-sm-6 col-xl-4" key={l.id}>
              <Link to={`/market/listings/${l.id}`} className="fl-plot-card">
                <div className="overflow-hidden position-relative">
                  <Photo path={l.photo_path} bucket="produce-photos" className="fl-plot-img" style={{ height: 170 }} />
                  {l.status !== 'open' && <span className="position-absolute top-0 start-0 m-2 fl-status neutral">{l.status === 'sold' ? 'Sold' : 'Closed'}</span>}
                </div>
                <div className="p-3">
                  <div className="d-flex justify-content-between"><span className="fw-semibold">{l.crop}</span><span className="fw-semibold text-deep">{l.price_per_unit != null ? `${fmtCedis(l.price_per_unit)}/${l.unit.replace(/s$/, '')}` : 'Open to offers'}</span></div>
                  <div className="small text-muted-fl">{fmtNumber(l.quantity)} {l.unit} · {l.region}</div>
                  <div className="small text-muted-fl">{displayName(l.seller)} · {timeAgo(l.created_at)}</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// FR16: listing page; buyers offer, sellers accept or decline
export function ListingDetail() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const [f, setF] = useState({ quantity: '', price_per_unit: '', message: '' })
  const [err, setErr] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const [l, offers] = await Promise.all([
      supabase.from('produce_listings').select(`*, ${SELLER}`).eq('id', id).single(),
      supabase.from('offers').select('*, buyer:profiles!offers_buyer_id_fkey(id, full_name, avatar_url, region)').eq('listing_id', id).order('created_at', { ascending: false }),
    ])
    if (l.error) throw l.error
    return { l: l.data, offers: offers.data || [] }
  }, [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { l, offers } = data
  const isSeller = l.seller_id === profile.id

  async function offer() {
    setErr('')
    const { error: e } = await supabase.from('offers').insert({ listing_id: id, buyer_id: profile.id, quantity: Number(f.quantity), price_per_unit: Number(f.price_per_unit), message: f.message || null })
    if (e) return setErr(errorMessage(e))
    setF({ quantity: '', price_per_unit: '', message: '' })
    reload()
  }
  async function respond(o, accept) {
    setErr('')
    const { error: e } = await supabase.rpc('respond_to_offer', { p_offer: o.id, p_accept: accept })
    if (e) return setErr(errorMessage(e))
    reload()
  }
  async function closeListing() {
    const { error: e } = await supabase.from('produce_listings').update({ status: 'closed' }).eq('id', id)
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <Link to="/market" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Marketplace</Link>
      <ErrorAlert error={err} />
      <div className="row g-4">
        <div className="col-lg-6">
          <Photo path={l.photo_path} bucket="produce-photos" className="w-100 rounded-fl-xl object-fit-cover" style={{ height: 'clamp(220px, 36vw, 380px)' }} />
        </div>
        <div className="col-lg-6 d-grid gap-3 align-content-start">
          <div>
            <h1 className="h2 mb-1">{l.crop}</h1>
            <div className="fs-5 fw-semibold text-deep">{l.price_per_unit != null ? `${fmtCedis(l.price_per_unit)} per ${l.unit.replace(/s$/, '')}` : 'Open to offers'}</div>
            <div className="text-muted-fl">{fmtNumber(l.quantity)} {l.unit} available · {l.region}</div>
          </div>
          {l.description && <p className="mb-0">{l.description}</p>}
          <Link to={`/u/${l.seller.id}`} className="fl-card p-3 d-flex align-items-center gap-3 text-decoration-none text-reset">
            <Avatar profile={l.seller} size={44} /><div><div className="small text-muted-fl">Seller</div><div className="fw-semibold">{displayName(l.seller)}</div></div>
          </Link>

          {role === 'buyer' && l.status === 'open' && (
            <div className="fl-card p-4">
              <h2 className="h5">Make an offer</h2>
              <div className="row g-2">
                <Field className="col-6" label={`Quantity (${l.unit})`} htmlFor="of-q"><input id="of-q" type="number" min="0.1" max={l.quantity} step="0.1" className="form-control" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
                <Field className="col-6" label="Price per unit (GH₵)" htmlFor="of-p"><input id="of-p" type="number" min="0" step="0.01" className="form-control" placeholder={l.price_per_unit ?? ''} value={f.price_per_unit} onChange={(e) => setF({ ...f, price_per_unit: e.target.value })} /></Field>
                <Field className="col-12" label="Message" htmlFor="of-m"><input id="of-m" className="form-control" placeholder="Collection date, place…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
              </div>
              {f.quantity && f.price_per_unit && <div className="small text-muted-fl mt-2">Total: {fmtCedis(Number(f.quantity) * Number(f.price_per_unit))}</div>}
              <ActionButton className="btn btn-primary mt-3" disabled={!f.quantity || f.price_per_unit === ''} onClick={offer}>Send offer</ActionButton>
            </div>
          )}

          {(isSeller || role === 'buyer' || role === 'admin') && (
            <div className="fl-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h5 mb-0">{isSeller ? 'Offers received' : 'Your offers'}</h2>
                {isSeller && l.status === 'open' && <ActionButton className="btn btn-sm btn-link text-danger" confirm="Close this listing?" onClick={closeListing}>Close listing</ActionButton>}
              </div>
              {offers.length === 0 ? <p className="small text-muted-fl mb-0">No offers yet.</p> : offers.map((o) => (
                <div key={o.id} className="d-flex flex-wrap align-items-center gap-2 py-2 border-top">
                  <Avatar profile={o.buyer} size={34} />
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold small">{o.buyer?.full_name} · {fmtNumber(o.quantity)} {l.unit} at {fmtCedis(o.price_per_unit)}</div>
                    <div className="small text-muted-fl">Total {fmtCedis(o.quantity * o.price_per_unit)}{o.message ? ` · ${o.message}` : ''}</div>
                  </div>
                  {isSeller && o.status === 'pending' ? (
                    <div className="d-flex gap-1">
                      <ActionButton className="btn btn-sm btn-primary" onClick={() => respond(o, true)}>Accept</ActionButton>
                      <ActionButton className="btn btn-sm btn-outline-danger" onClick={() => respond(o, false)}>Decline</ActionButton>
                    </div>
                  ) : <StatusBadge map={OFFER_STATUS} value={o.status} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MyOffers() {
  const { profile } = useAuth()
  const { data, loading, error, reload } = useQuery(() => supabase.from('offers').select('*, produce_listings(id, crop, unit, region, seller:profiles!produce_listings_seller_id_fkey(full_name, is_group, group_name))').eq('buyer_id', profile.id).order('created_at', { ascending: false }), [profile.id])
  async function withdraw(o) {
    await supabase.from('offers').update({ status: 'withdrawn' }).eq('id', o.id)
    reload()
  }
  return (
    <div className="fl-page">
      <PageHeader eyebrow="Buyer" title="My offers" actions={<Link to="/market" className="btn btn-primary">Browse produce</Link>} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : !data?.length ? <div className="fl-card"><EmptyState icon="bi-tags" title="No offers yet" /></div> : (
        <div className="fl-card p-2">
          {data.map((o) => (
            <div key={o.id} className="fl-list-item">
              <span className="fl-icon-tile soft flex-none"><i className="bi bi-tag" /></span>
              <Link to={`/market/listings/${o.produce_listings.id}`} className="flex-grow-1 min-w-0 text-reset text-decoration-none">
                <div className="fw-semibold">{o.produce_listings.crop} · {fmtNumber(o.quantity)} {o.produce_listings.unit} at {fmtCedis(o.price_per_unit)}</div>
                <div className="small text-muted-fl">{displayName(o.produce_listings.seller)} · {o.produce_listings.region} · {timeAgo(o.created_at)}</div>
              </Link>
              {o.status === 'pending' && <ActionButton className="btn btn-sm btn-link text-danger" onClick={() => withdraw(o)}>Withdraw</ActionButton>}
              <StatusBadge map={OFFER_STATUS} value={o.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
