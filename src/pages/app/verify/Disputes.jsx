import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, StatusBadge, Field, ActionButton, Photo } from '../../../components/ui'
import ChatThread from '../../../components/ChatThread'
import { AgreementSummary } from '../deals/AgreementTab'
import { DisputeCard } from '../deals/DisputeTab'
import { DISPUTE_STATUS, DISPUTE_CATEGORIES, MILESTONES } from '../../../lib/constants'
import { timeAgo, displayName, fmtDate, fmtNumber } from '../../../lib/format'

const P = 'id, full_name, is_group, group_name, avatar_url'
const DSELECT = `*, deals(id, application_id, landowner_id, farmer_id, status, plots(title, region, district),
  landowner:profiles!deals_landowner_id_fkey(${P}), farmer:profiles!deals_farmer_id_fkey(${P}))`

// Verifier (or admin) list of disputes
export function DisputeList() {
  const { profile, role } = useAuth()
  const [tab, setTab] = useState('live')
  const { data, loading, error, reload } = useQuery(() => {
    let q = supabase.from('disputes').select(DSELECT).order('created_at', { ascending: false })
    if (role === 'verifier') q = q.eq('verifier_id', profile.id)
    return q
  }, [profile.id, role])
  const rows = (data || []).filter((d) => (tab === 'live' ? ['open', 'in_mediation'].includes(d.status) : ['resolved', 'closed'].includes(d.status)))

  return (
    <div className="fl-page">
      <PageHeader eyebrow={role === 'admin' ? 'Admin' : 'Verifier'} title="Disputes" text="Mediate using the agreement, season updates and chat on record." />
      <div className="d-flex gap-2 mb-4">
        {[['live', 'Open'], ['done', 'Resolved']].map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-shield-check" title="Nothing here" text="Disputes raised on deals you oversee appear here." /></div>
      ) : (
        <div className="fl-card p-2">
          {rows.map((d) => (
            <Link key={d.id} to={`/verify/disputes/${d.id}`} className="fl-list-item">
              <span className="fl-icon-tile soft flex-none"><i className="bi bi-shield-exclamation" /></span>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{d.deals.plots.title} · {DISPUTE_CATEGORIES[d.category]}</div>
                <div className="small text-muted-fl text-truncate">{displayName(d.deals.landowner)} and {displayName(d.deals.farmer)} · {timeAgo(d.created_at)}</div>
              </div>
              {!d.verifier_id && <span className="fl-status pending">No verifier</span>}
              <StatusBadge map={DISPUTE_STATUS} value={d.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// Mediation page: evidence on the left, decision on the right
export function DisputeMediation() {
  const { id } = useParams()
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')
  const { data, loading, error, reload } = useQuery(async () => {
    const { data: d, error: e } = await supabase.from('disputes').select(DSELECT).eq('id', id).maybeSingle()
    if (e) throw e
    if (!d) throw new Error('Dispute not found.')
    const [ag, ms, hv] = await Promise.all([
      supabase.from('agreements').select('*').eq('deal_id', d.deal_id).order('version', { ascending: false }),
      supabase.from('season_milestones').select('*').eq('deal_id', d.deal_id).order('occurred_on'),
      supabase.from('harvest_records').select('*').eq('deal_id', d.deal_id).maybeSingle(),
    ])
    return { d, agreements: ag.data || [], milestones: ms.data || [], harvest: hv.data }
  }, [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { d, agreements, milestones, harvest } = data
  const current = agreements.find((a) => a.landowner_confirmed_at && a.farmer_confirmed_at)
  const form = f || { status: d.status === 'open' ? 'in_mediation' : d.status, proposed: d.proposed_resolution || '', resolution: d.resolution || '' }
  const live = ['open', 'in_mediation'].includes(d.status)

  async function save() {
    setErr('')
    setSaved('')
    const { error: e } = await supabase.rpc('update_dispute', { p_dispute: d.id, p_status: form.status, p_proposed_resolution: form.proposed || null, p_resolution: form.resolution || null })
    if (e) return setErr(errorMessage(e))
    setSaved('Saved. Both parties have been notified.')
    setF(null)
    reload()
  }

  return (
    <div className="fl-page">
      <Link to="/verify/disputes" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Disputes</Link>
      <PageHeader title={d.deals.plots.title} text={`${displayName(d.deals.landowner)} (landowner) and ${displayName(d.deals.farmer)} (farmer)`}
        actions={<Link to={`/deals/${d.deals.id}`} className="btn btn-outline-primary">Open deal</Link>} />
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <DisputeCard d={d} deal={d.deals} />
          <section className="fl-card p-4">
            <h2 className="h5">Agreement in force</h2>
            {current ? <AgreementSummary ag={current} deal={d.deals} /> : <p className="text-muted-fl mb-0">No agreement was confirmed by both parties.</p>}
          </section>
          <section className="fl-card p-4">
            <h2 className="h5">Season record</h2>
            {milestones.length === 0 ? <p className="text-muted-fl small mb-0">No season updates.</p> : milestones.map((m) => (
              <div key={m.id} className="d-flex gap-3 py-2 border-top">
                <div style={{ width: 90 }} className="small fw-semibold">{MILESTONES.find((x) => x.key === m.milestone)?.label}<div className="text-muted-fl fw-normal">{fmtDate(m.occurred_on)}</div></div>
                <div className="flex-grow-1 small">{m.note}<div className="d-flex gap-2 mt-1">{m.photo_paths.map((p) => <Photo key={p} path={p} bucket="milestone-photos" className="rounded-2 object-fit-cover" style={{ width: 80, height: 60 }} />)}</div></div>
              </div>
            ))}
            {harvest && <div className="border-top pt-2 small"><strong>Harvest:</strong> {fmtNumber(harvest.total_quantity)} {harvest.unit} → landowner {fmtNumber(harvest.landowner_share)}, farmer {fmtNumber(harvest.farmer_share)}</div>}
          </section>
          <section className="fl-card p-0 overflow-hidden">
            <div className="p-3 border-bottom fw-semibold"><i className="bi bi-chat-dots me-1" />Chat between the parties <span className="small text-muted-fl fw-normal">· read-only</span></div>
            <ChatThread applicationId={d.deals.application_id} canSend={false} height={360} showNames />
          </section>
        </div>
        <div className="col-lg-5">
          <section className="fl-card p-4" style={{ position: 'sticky', top: '6rem' }}>
            <h2 className="h5">Mediation</h2>
            {err && <div className="alert alert-danger py-2">{err}</div>}
            {saved && <div className="alert alert-success py-2">{saved}</div>}
            <div className="d-grid gap-3">
              <Field label="Status" htmlFor="md-status">
                <select id="md-status" className="form-select" value={form.status} onChange={(e) => setF({ ...form, status: e.target.value })}>
                  {Object.entries(DISPUTE_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Proposed resolution" htmlFor="md-prop" hint="Shared with both parties. Refer to the agreement version.">
                <textarea id="md-prop" className="form-control" rows={4} value={form.proposed} onChange={(e) => setF({ ...form, proposed: e.target.value })} />
              </Field>
              <Field label="Final outcome" htmlFor="md-res" hint="Required to mark the dispute resolved or closed.">
                <textarea id="md-res" className="form-control" rows={3} value={form.resolution} onChange={(e) => setF({ ...form, resolution: e.target.value })} />
              </Field>
              <ActionButton className="btn btn-primary" onClick={save}>{live ? 'Save and notify parties' : 'Update record'}</ActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
