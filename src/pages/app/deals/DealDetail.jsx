import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { Loading, ErrorAlert, StatusBadge, Avatar, ActionButton, Field, PageHeader } from '../../../components/ui'
import { coverPhoto } from '../../../components/cards'
import ChatThread from '../../../components/ChatThread'
import AgreementTab from './AgreementTab'
import SeasonTab from './SeasonTab'
import HarvestTab from './HarvestTab'
import DisputeTab from './DisputeTab'
import { DEAL_STATUS, MILESTONES } from '../../../lib/constants'
import { fmtDate, fmtNumber, displayName } from '../../../lib/format'

const P = 'id, full_name, is_group, group_name, group_size, avatar_url, region'
const TABS = [
  ['overview', 'Overview', 'bi-house'], ['agreement', 'Agreement', 'bi-file-earmark-text'], ['season', 'Season', 'bi-flower2'],
  ['harvest', 'Harvest', 'bi-basket'], ['chat', 'Chat', 'bi-chat-dots'], ['dispute', 'Dispute', 'bi-shield'],
]

function RatePanel({ deal, rated, reload }) {
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  if (rated) return <div className="fl-card p-4"><i className="bi bi-star-fill text-ochre me-1" />You rated this partnership {rated.score}/5. Thank you.</div>
  async function submit() {
    const other = deal.isLandowner ? deal.farmer_id : deal.landowner_id
    const { error } = await supabase.from('ratings').insert({ deal_id: deal.id, rater_id: deal.me, ratee_id: other, score, comment: comment || null })
    if (error) return setErr(errorMessage(error))
    reload()
  }
  return (
    <div className="fl-card p-4">
      <h3 className="h5">Rate {displayName(deal.isLandowner ? deal.farmer : deal.landowner)}</h3>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <div className="d-flex gap-1 mb-3" role="radiogroup" aria-label="Score">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} stars`} className="btn btn-link p-0 fs-3 text-ochre" onClick={() => setScore(n)}>
            <i className={`bi ${n <= score ? 'bi-star-fill' : 'bi-star'}`} />
          </button>
        ))}
      </div>
      <Field label="Comment (shown on their public profile)" htmlFor="rate-c" className="mb-3"><textarea id="rate-c" className="form-control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <ActionButton className="btn btn-primary" onClick={submit}>Submit rating</ActionButton>
    </div>
  )
}

function NextStep({ deal, latest, harvest, setTab }) {
  const me = deal.isLandowner ? 'landowner_confirmed_at' : 'farmer_confirmed_at'
  let text; let tab; let cta
  if (deal.status === 'drafting' && !latest) { text = 'Agree the terms: crop, dates, who supplies what, and the harvest split.'; tab = 'agreement'; cta = 'Start the agreement' }
  else if (deal.status === 'drafting' && latest && !latest[me]) { text = 'The other party proposed terms. Review and confirm them.'; tab = 'agreement'; cta = 'Review terms' }
  else if (deal.status === 'drafting') { text = 'Waiting for the other party to confirm the terms.'; tab = 'agreement'; cta = 'View terms' }
  else if (deal.status === 'active' && deal.isFarmer) { text = 'Post updates as you clear, plant, weed and harvest. Record the harvest when it is in.'; tab = deal.milestoneCount >= 4 ? 'harvest' : 'season'; cta = deal.milestoneCount >= 4 ? 'Record harvest' : 'Post an update' }
  else if (deal.status === 'active') { text = 'The season is running. Follow the farmer’s updates.'; tab = 'season'; cta = 'See updates' }
  else if (deal.status === 'harvested' && deal.isLandowner) { text = 'The harvest is recorded. Confirm you received your share to complete the season.'; tab = 'harvest'; cta = 'Confirm share' }
  else if (deal.status === 'harvested') { text = 'Waiting for the landowner to confirm the share.'; tab = 'harvest'; cta = 'View split' }
  else if (deal.status === 'completed') { text = 'Season completed. Rate your partner below.'; tab = harvest ? 'harvest' : 'overview'; cta = 'View harvest' }
  else { text = 'This deal was cancelled before it started.'; tab = null }
  return (
    <div className="fl-card p-4 d-flex flex-wrap align-items-center gap-3" style={{ background: 'linear-gradient(120deg, #fff, #F3F9E6)' }}>
      <span className="fl-icon-tile"><i className="bi bi-signpost-2" /></span>
      <div className="flex-grow-1" style={{ minWidth: 220 }}><div className="small text-muted-fl">Next step</div><div className="fw-semibold">{text}</div></div>
      {tab && deal.isParty && <button type="button" className="btn btn-primary" onClick={() => setTab(tab)}>{cta}</button>}
    </div>
  )
}

export default function DealDetail() {
  const { id } = useParams()
  const { profile, role } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const [err, setErr] = useState('')

  const { data, loading, error, reload } = useQuery(async () => {
    const { data: deal, error: e } = await supabase.from('deals').select(`*, plots(*, plot_photos(storage_path, sort_order, is_document)),
      applications(planned_crop, proposed_duration_months),
      landowner:profiles!deals_landowner_id_fkey(${P}), farmer:profiles!deals_farmer_id_fkey(${P}), verifier:profiles!deals_verifier_id_fkey(${P})`).eq('id', id).maybeSingle()
    if (e) throw e
    if (!deal) throw new Error('Deal not found.')
    const [ags, ms, hv, ds, rt, phone] = await Promise.all([
      supabase.from('agreements').select('*').eq('deal_id', id).order('version', { ascending: false }),
      supabase.from('season_milestones').select('*').eq('deal_id', id).order('occurred_on').order('created_at'),
      supabase.from('harvest_records').select('*').eq('deal_id', id).maybeSingle(),
      supabase.from('disputes').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
      supabase.from('ratings').select('*').eq('deal_id', id).eq('rater_id', profile.id).maybeSingle(),
      supabase.rpc('get_contact_phone', { p_user: deal.landowner_id === profile.id ? deal.farmer_id : deal.landowner_id }),
    ])
    return { deal, agreements: ags.data || [], milestones: ms.data || [], harvest: hv.data, disputes: ds.data || [], rated: rt.data, phone: phone.data }
  }, [id, profile.id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { agreements, milestones, harvest, disputes, rated, phone } = data
  const deal = {
    ...data.deal,
    me: profile.id,
    isLandowner: data.deal.landowner_id === profile.id,
    isFarmer: data.deal.farmer_id === profile.id,
    isParty: [data.deal.landowner_id, data.deal.farmer_id].includes(profile.id),
    milestoneCount: new Set(milestones.map((m) => m.milestone)).size,
  }
  const current = agreements.find((a) => a.landowner_confirmed_at && a.farmer_confirmed_at)
  const other = deal.isLandowner ? deal.farmer : deal.landowner
  const openDisputes = disputes.filter((d) => ['open', 'in_mediation'].includes(d.status)).length

  async function cancel() {
    const { error: e } = await supabase.rpc('cancel_deal', { p_deal: deal.id })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  return (
    <div className="fl-page">
      <Link to="/deals" className="small d-inline-block mb-3 d-print-none"><i className="bi bi-arrow-left me-1" />Deals</Link>
      <PageHeader photo={{ path: coverPhoto(deal.plots), bucket: 'plot-photos' }} eyebrow={`Deal · ${DEAL_STATUS[deal.status][0]}`} title={deal.plots.title}
        text={`${fmtNumber(deal.plots.size_acres)} acres · ${[deal.plots.district, deal.plots.region].filter(Boolean).join(', ')} · ${displayName(deal.landowner)} and ${displayName(deal.farmer)}`}
        actions={openDisputes > 0 && <span className="fl-status rejected">Dispute open</span>}
        stats={[
          { icon: 'bi-flower1', label: 'Crop', value: current?.crop || deal.applications?.planned_crop || '–' },
          { icon: 'bi-pie-chart', label: 'Split', value: current ? `${fmtNumber(current.landowner_percent)}/${fmtNumber(100 - current.landowner_percent)}` : '–' },
          { icon: 'bi-flag', label: 'Milestones', value: `${deal.milestoneCount}/4`, highlight: deal.status === 'active' },
        ]} />
      <ErrorAlert error={err} />

      <div className="fl-tabs d-print-none mb-4" role="tablist">
        {TABS.map(([k, label, icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`fl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            <i className={`bi ${icon}`} /><span>{label}</span>
            {k === 'dispute' && openDisputes > 0 && <span className="badge rounded-pill bg-danger ms-1">{openDisputes}</span>}
          </button>
        ))}
      </div>

      <div key={tab} className="fl-swap">
        {tab === 'overview' && (
          <div className="row g-4">
            <div className="col-lg-8 d-grid gap-4 align-content-start">
              <NextStep deal={deal} latest={agreements[0]} harvest={harvest} setTab={setTab} />
              <section className="fl-card p-4">
                <h2 className="h5 mb-3">Season at a glance</h2>
                <div className="row g-3">
                  <div className="col-sm-4"><div className="small text-muted-fl">Crop</div><div className="fw-semibold">{current?.crop || deal.applications?.planned_crop}</div></div>
                  <div className="col-sm-4"><div className="small text-muted-fl">Season</div><div className="fw-semibold">{current ? `${fmtDate(current.start_date)} – ${fmtDate(current.end_date)}` : 'Not agreed yet'}</div></div>
                  <div className="col-sm-4"><div className="small text-muted-fl">Split</div><div className="fw-semibold">{current ? `${fmtNumber(current.landowner_percent)} / ${fmtNumber(100 - current.landowner_percent)}` : '–'}</div></div>
                </div>
                <div className="d-flex gap-2 mt-4">
                  {MILESTONES.map((m) => {
                    const done = milestones.some((x) => x.milestone === m.key)
                    return <div key={m.key} className="flex-grow-1"><div className={`rounded-pill mb-1 ${done ? 'bg-primary' : ''}`} style={{ height: 6, background: done ? undefined : 'var(--fl-line)' }} /><div className={`small ${done ? 'fw-semibold' : 'text-muted-fl'}`}>{m.label}</div></div>
                  })}
                </div>
                {harvest && <div className="mt-3 small"><i className="bi bi-basket me-1" />Harvest: {fmtNumber(harvest.total_quantity)} {harvest.unit} → landowner {fmtNumber(harvest.landowner_share)}, farmer {fmtNumber(harvest.farmer_share)}</div>}
              </section>
              {deal.status === 'completed' && deal.isParty && <RatePanel deal={deal} rated={rated} reload={reload} />}
            </div>
            <div className="col-lg-4 d-grid gap-3 align-content-start">
              {[['Landowner', deal.landowner], ['Farmer', deal.farmer], ['Verifier', deal.verifier]].map(([label, p]) => p && (
                <div className="fl-card p-3 d-flex align-items-center gap-3" key={label}>
                  <Avatar profile={p} size={44} />
                  <div className="flex-grow-1 min-w-0">
                    <div className="small text-muted-fl">{label}{p.id === profile.id && ' (you)'}</div>
                    <Link to={`/u/${p.id}`} className="fw-semibold text-reset text-truncate d-block">{displayName(p)}</Link>
                  </div>
                  {p.id === other?.id && phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="btn btn-sm btn-outline-primary" aria-label={`Call ${displayName(p)}`}><i className="bi bi-telephone" /></a>}
                </div>
              ))}
              <Link to={deal.isLandowner ? `/plots/${deal.plot_id}` : `/find/${deal.plot_id}`} className="btn btn-outline-primary"><i className="bi bi-geo-alt me-1" />View plot</Link>
              <Link to={`/help?new=1&category=deal&about=/deals/${deal.id}`} className="btn btn-link btn-sm"><i className="bi bi-question-circle me-1" />Problem with the platform? Contact support</Link>
              {deal.status === 'drafting' && deal.isParty && (
                <ActionButton className="btn btn-link text-danger" confirm="Cancel this deal? The plot will be listed again." onClick={cancel}>Cancel deal</ActionButton>
              )}
            </div>
          </div>
        )}
        {tab === 'agreement' && <AgreementTab deal={deal} agreements={agreements} isParty={deal.isParty} reload={reload} />}
        {tab === 'season' && <SeasonTab deal={deal} milestones={milestones} isFarmer={deal.isFarmer} reload={reload} />}
        {tab === 'harvest' && <HarvestTab deal={deal} harvest={harvest} current={current} isFarmer={deal.isFarmer} isLandowner={deal.isLandowner} reload={reload} />}
        {tab === 'chat' && (
          <section className="fl-card p-0 overflow-hidden">
            <div className="d-flex align-items-center gap-2 p-3 border-bottom">
              <Avatar profile={other} size={36} /><div><div className="fw-semibold">{deal.isParty ? displayName(other) : `${displayName(deal.landowner)} and ${displayName(deal.farmer)}`}</div><div className="small text-muted-fl"><i className="bi bi-lock-fill me-1" />{deal.isParty ? 'Private to this deal' : 'Read-only for verifiers and admins'}</div></div>
            </div>
            <ChatThread applicationId={deal.application_id} canSend={deal.isParty && deal.status !== 'cancelled'} showNames={!deal.isParty} />
          </section>
        )}
        {tab === 'dispute' && <DisputeTab deal={deal} disputes={disputes} isParty={deal.isParty} reload={reload} />}
      </div>
      {role === 'admin' && !deal.isParty && <p className="small text-muted-fl mt-4">You are viewing this deal as an administrator.</p>}
    </div>
  )
}
