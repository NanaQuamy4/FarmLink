import { useState } from 'react'
import { supabase, errorMessage } from '../../../lib/supabase'
import { calculateHarvestSplit } from '../../../lib/harvestSplit'
import { ActionButton, Field } from '../../../components/ui'
import { RESPONSIBILITIES, HARVEST_UNITS, CROPS } from '../../../lib/constants'
import { fmtDate, fmtDateTime, fmtNumber, displayName } from '../../../lib/format'

const WHO = { landowner: 'Landowner', farmer: 'Farmer', shared: 'Shared', na: 'Not needed' }

export function AgreementSummary({ ag, deal }) {
  const example = calculateHarvestSplit({ total: 100, landownerPercent: ag.landowner_percent, deduction: Math.min(ag.deduction_amount, 100), deductionTo: ag.deduction_to })
  return (
    <div className="fl-agreement">
      <div className="row g-3 mb-3">
        {[['Crop', ag.crop], ['Season', `${fmtDate(ag.start_date)} – ${fmtDate(ag.end_date)}`],
          ['Harvest split', `${fmtNumber(ag.landowner_percent)}% landowner · ${fmtNumber(100 - ag.landowner_percent)}% farmer`],
          ['Input deduction', Number(ag.deduction_amount) > 0 ? `${fmtNumber(ag.deduction_amount)} ${ag.harvest_unit} to the ${ag.deduction_to} before the split` : 'None'],
        ].map(([k, v]) => <div className="col-sm-6" key={k}><div className="small text-muted-fl">{k}</div><div className="fw-semibold">{v}</div></div>)}
      </div>
      <div className="small text-muted-fl mb-1">Who provides what</div>
      <div className="row g-2 mb-3">
        {RESPONSIBILITIES.filter((r) => ag.responsibilities?.[r.key]).map((r) => (
          <div className="col-sm-6" key={r.key}><div className="d-flex justify-content-between border rounded-3 px-3 py-2 small"><span>{r.label}</span><strong>{WHO[ag.responsibilities[r.key]]}</strong></div></div>
        ))}
      </div>
      {ag.notes && <p className="small mb-3"><strong>Notes:</strong> {ag.notes}</p>}
      <div className="small text-muted-fl"><i className="bi bi-calculator me-1" />Example: from 100 {ag.harvest_unit}, the landowner gets {fmtNumber(example.landownerShare)} and the farmer {fmtNumber(example.farmerShare)}.</div>
      {deal && (
        <div className="d-flex flex-wrap gap-3 mt-3 small">
          <span><i className={`bi ${ag.landowner_confirmed_at ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted-fl'} me-1`} />{displayName(deal.landowner)} {ag.landowner_confirmed_at ? `confirmed ${fmtDateTime(ag.landowner_confirmed_at)}` : 'has not confirmed'}</span>
          <span><i className={`bi ${ag.farmer_confirmed_at ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted-fl'} me-1`} />{displayName(deal.farmer)} {ag.farmer_confirmed_at ? `confirmed ${fmtDateTime(ag.farmer_confirmed_at)}` : 'has not confirmed'}</span>
        </div>
      )}
    </div>
  )
}

function AgreementForm({ deal, base, onDone, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({
    crop: base?.crop || deal.applications?.planned_crop || '',
    start_date: base?.start_date || today,
    end_date: base?.end_date || new Date(Date.now() + 1000 * 3600 * 24 * 30 * (deal.applications?.proposed_duration_months || 6)).toISOString().slice(0, 10),
    landowner_percent: base?.landowner_percent ?? 30,
    harvest_unit: base?.harvest_unit || 'bags',
    deduction_amount: base?.deduction_amount ?? 0,
    deduction_to: base?.deduction_to || 'farmer',
    responsibilities: base?.responsibilities || { seed: 'farmer', fertiliser: 'farmer', land_clearing: 'landowner', labour: 'farmer', irrigation: 'na', transport: 'shared' },
    notes: base?.notes || '',
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pct = Number(f.landowner_percent)

  async function submit(e) {
    e.preventDefault()
    if (f.end_date <= f.start_date) return setErr('The end date must be after the start date.')
    const { error } = await supabase.rpc('propose_agreement', {
      p_deal: deal.id, p_crop: f.crop, p_start_date: f.start_date, p_end_date: f.end_date, p_landowner_percent: pct,
      p_harvest_unit: f.harvest_unit, p_deduction_amount: Number(f.deduction_amount) || 0, p_deduction_to: f.deduction_to,
      p_responsibilities: f.responsibilities, p_notes: f.notes || null,
    })
    if (error) return setErr(errorMessage(error))
    onDone()
  }

  return (
    <form onSubmit={submit} className="fl-card p-4">
      <h3 className="h5">{base ? 'Propose a change' : 'Agreement builder'}</h3>
      <p className="small text-muted-fl">Your proposal is confirmed by you when you send it. The other party then reviews and confirms.</p>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <div className="row g-3">
        <Field className="col-sm-6" label="Crop" htmlFor="ag-crop">
          <input id="ag-crop" className="form-control" list="ag-crops" required value={f.crop} onChange={set('crop')} /><datalist id="ag-crops">{CROPS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field className="col-sm-3" label="Start" htmlFor="ag-start"><input id="ag-start" type="date" className="form-control" required value={f.start_date} onChange={set('start_date')} /></Field>
        <Field className="col-sm-3" label="End" htmlFor="ag-end"><input id="ag-end" type="date" className="form-control" required value={f.end_date} onChange={set('end_date')} /></Field>
        <div className="col-12">
          <label className="form-label d-flex justify-content-between" htmlFor="ag-pct"><span>Harvest split</span><span className="text-muted-fl">Landowner {pct}% · Farmer {100 - pct}%</span></label>
          <input id="ag-pct" type="range" className="form-range" min="0" max="100" step="5" value={pct} onChange={set('landowner_percent')} />
        </div>
        <Field className="col-sm-4" label="Harvest measured in" htmlFor="ag-unit">
          <select id="ag-unit" className="form-select" value={f.harvest_unit} onChange={set('harvest_unit')}>{HARVEST_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field className="col-sm-4" label="Input deduction" htmlFor="ag-ded" hint="Taken off the top before the split."><input id="ag-ded" type="number" min="0" step="0.5" className="form-control" value={f.deduction_amount} onChange={set('deduction_amount')} /></Field>
        <Field className="col-sm-4" label="Deduction goes to" htmlFor="ag-dedto">
          <select id="ag-dedto" className="form-select" value={f.deduction_to} onChange={set('deduction_to')}><option value="farmer">Farmer</option><option value="landowner">Landowner</option></select>
        </Field>
        <div className="col-12">
          <span className="form-label d-block">Who provides what</span>
          <div className="row g-2">
            {RESPONSIBILITIES.map((r) => (
              <div className="col-md-6" key={r.key}>
                <div className="d-flex align-items-center justify-content-between gap-2 border rounded-3 px-3 py-2">
                  <label className="small" htmlFor={`resp-${r.key}`}>{r.label}</label>
                  <select id={`resp-${r.key}`} className="form-select form-select-sm w-auto" value={f.responsibilities[r.key] || 'na'} onChange={(e) => setF({ ...f, responsibilities: { ...f.responsibilities, [r.key]: e.target.value } })}>
                    {Object.entries(WHO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field className="col-12" label="Other terms (optional)" htmlFor="ag-notes"><textarea id="ag-notes" className="form-control" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>
      <div className="d-flex gap-2 mt-4">
        <ActionButton className="btn btn-primary" onClick={() => submit({ preventDefault() {} })}>Send to {deal.isLandowner ? 'farmer' : 'landowner'}</ActionButton>
        {onCancel && <button type="button" className="btn btn-outline-primary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// FR6: agreement builder, versions, and confirmation by both parties.
export default function AgreementTab({ deal, agreements, isParty, reload }) {
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const latest = agreements[0]
  const current = agreements.find((a) => a.landowner_confirmed_at && a.farmer_confirmed_at)
  const myConfirmField = deal.isLandowner ? 'landowner_confirmed_at' : 'farmer_confirmed_at'
  const waitingOnMe = latest && isParty && !latest[myConfirmField]
  const canPropose = isParty && ['drafting', 'active'].includes(deal.status)

  async function confirm() {
    setErr('')
    const { error } = await supabase.rpc('confirm_agreement', { p_agreement: latest.id })
    if (error) return setErr(errorMessage(error))
    reload()
  }

  if (!latest || editing) {
    return canPropose
      ? <AgreementForm deal={deal} base={editing ? latest : null} onDone={() => { setEditing(false); reload() }} onCancel={editing ? () => setEditing(false) : null} />
      : <div className="fl-card p-4 text-muted-fl">No agreement has been proposed yet.</div>
  }

  return (
    <div className="d-grid gap-4">
      {err && <div className="alert alert-danger mb-0">{err}</div>}
      {latest !== current && (
        <section className="fl-card p-4 border-warning" style={{ borderWidth: 2 }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="h5 mb-0">Version {latest.version} <span className="fl-status pending ms-2">Waiting for confirmation</span></h3>
          </div>
          <AgreementSummary ag={latest} deal={deal} />
          {waitingOnMe && (
            <div className="d-flex flex-wrap gap-2 mt-4">
              <ActionButton className="btn btn-primary" confirm="Confirm these terms? Both parties will see this record." onClick={confirm}><i className="bi bi-check2-circle me-1" />Confirm these terms</ActionButton>
              <button type="button" className="btn btn-outline-primary" onClick={() => setEditing(true)}>Suggest changes</button>
            </div>
          )}
          {!waitingOnMe && isParty && <p className="small text-muted-fl mt-3 mb-0">Waiting for the other party to confirm.</p>}
        </section>
      )}
      {current && (
        <section className="fl-card p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h3 className="h5 mb-0">Agreement in force <span className="text-muted-fl fw-normal">· version {current.version}</span></h3>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print or save PDF</button>
              {canPropose && latest === current && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditing(true)}>Propose a change</button>}
            </div>
          </div>
          <AgreementSummary ag={current} deal={deal} />
        </section>
      )}
      <div className="alert alert-light border small mb-0"><i className="bi bi-info-circle me-1" />This agreement is a record of what both parties confirmed on FarmLink. It is not a legally binding contract.</div>
      {agreements.length > 1 && (
        <details className="fl-card p-3">
          <summary className="fw-semibold">Version history ({agreements.length})</summary>
          {agreements.map((a) => (
            <div key={a.id} className="border-top pt-2 mt-2 small">
              <strong>Version {a.version}</strong> · {fmtDateTime(a.created_at)} · {a.crop}, {fmtNumber(a.landowner_percent)}% landowner
              {a.landowner_confirmed_at && a.farmer_confirmed_at ? <span className="fl-status verified ms-2">Confirmed</span> : <span className="fl-status neutral ms-2">Not confirmed by both</span>}
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
