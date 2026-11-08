import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { StatusBadge, Field, ActionButton } from '../../../components/ui'
import { DISPUTE_STATUS, DISPUTE_CATEGORIES } from '../../../lib/constants'
import { fmtDateTime, displayName } from '../../../lib/format'

export function DisputeCard({ d, deal }) {
  const raisedBy = d.raised_by === deal.landowner_id ? deal.landowner : deal.farmer
  return (
    <section className="fl-card p-4">
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
        <div><h3 className="h6 mb-0">{DISPUTE_CATEGORIES[d.category]}</h3><div className="small text-muted-fl">Raised by {displayName(raisedBy)} · {fmtDateTime(d.created_at)}</div></div>
        <StatusBadge map={DISPUTE_STATUS} value={d.status} />
      </div>
      <p className="mb-3" style={{ whiteSpace: 'pre-line' }}>{d.description}</p>
      {d.proposed_resolution && (
        <div className="border rounded-3 p-3 mb-2" style={{ background: '#FBF6EC' }}>
          <div className="small fw-semibold mb-1"><i className="bi bi-person-badge me-1" />Verifier’s proposal</div>
          <div className="small">{d.proposed_resolution}</div>
        </div>
      )}
      {d.resolution && (
        <div className="border rounded-3 p-3" style={{ background: '#EEF6E6' }}>
          <div className="small fw-semibold mb-1"><i className="bi bi-check2-circle me-1" />Outcome {d.resolved_at && `· ${fmtDateTime(d.resolved_at)}`}</div>
          <div className="small">{d.resolution}</div>
        </div>
      )}
    </section>
  )
}

// FR9: either party raises a dispute; the verifier mediates using the recorded agreement, photos and chat.
export default function DisputeTab({ deal, disputes, isParty, reload }) {
  const { role } = useAuth()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ category: 'inputs', description: '' })
  const [err, setErr] = useState('')
  const live = disputes.some((d) => ['open', 'in_mediation'].includes(d.status))

  async function raise() {
    setErr('')
    const { error } = await supabase.from('disputes').insert({ deal_id: deal.id, raised_by: deal.me, category: f.category, description: f.description })
    if (error) return setErr(errorMessage(error))
    setOpen(false)
    setF({ category: 'inputs', description: '' })
    reload()
  }

  return (
    <div className="d-grid gap-4">
      {disputes.length === 0 && !open && (
        <div className="fl-card p-4 text-center">
          <i className="bi bi-shield-check fs-1 text-deep d-block mb-2" />
          <h3 className="h5">No disputes</h3>
          <p className="text-muted-fl mx-auto" style={{ maxWidth: 480 }}>If something goes against the agreement, raise it here. {deal.verifier ? displayName(deal.verifier) : 'A verifier'} will look at the agreement, season photos and chat, and propose a fair outcome.</p>
        </div>
      )}
      {disputes.map((d) => (
        <div key={d.id}>
          <DisputeCard d={d} deal={deal} />
          {(role === 'verifier' || role === 'admin') && ['open', 'in_mediation'].includes(d.status) && (
            <Link to={`/verify/disputes/${d.id}`} className="btn btn-primary mt-2">Mediate this dispute</Link>
          )}
        </div>
      ))}
      {isParty && deal.status !== 'cancelled' && !open && (
        <button type="button" className="btn btn-outline-danger justify-self-start" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>
          <i className="bi bi-flag me-1" />{live ? 'Raise another issue' : 'Raise a dispute'}
        </button>
      )}
      {open && (
        <div className="fl-card p-4">
          <h3 className="h5">Raise a dispute</h3>
          <p className="small text-muted-fl">The other party and the verifier will be notified. Try talking in the chat first if you can.</p>
          {err && <div className="alert alert-danger py-2">{err}</div>}
          <div className="d-grid gap-3">
            <Field label="What is it about?" htmlFor="ds-cat">
              <select id="ds-cat" className="form-select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {Object.entries(DISPUTE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Describe what happened" htmlFor="ds-desc" hint="Refer to the agreement or season updates where you can.">
              <textarea id="ds-desc" className="form-control" rows={4} minLength={10} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <div className="d-flex gap-2">
              <ActionButton className="btn btn-danger" disabled={f.description.trim().length < 10} onClick={raise}>Raise dispute</ActionButton>
              <button type="button" className="btn btn-outline-primary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
