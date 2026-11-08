import { useState } from 'react'
import { supabase, errorMessage } from '../../../lib/supabase'
import { uploadPhoto } from '../../../lib/storage'
import { Photo, Field } from '../../../components/ui'
import { MILESTONES } from '../../../lib/constants'
import { fmtDate } from '../../../lib/format'

// FR7: milestones with dated photo updates. Only the farmer posts.
export default function SeasonTab({ deal, milestones, isFarmer, reload }) {
  const done = new Set(milestones.map((m) => m.milestone))
  const nextKey = MILESTONES.find((m) => !done.has(m.key))?.key || 'harvested'
  const [f, setF] = useState({ milestone: nextKey, occurred_on: new Date().toISOString().slice(0, 10), note: '' })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function post(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const paths = []
      for (const file of files) paths.push(await uploadPhoto('milestone-photos', deal.id, file))
      const { error } = await supabase.from('season_milestones').insert({ deal_id: deal.id, milestone: f.milestone, occurred_on: f.occurred_on, note: f.note || null, photo_paths: paths, posted_by: deal.farmer_id })
      if (error) throw error
      setFiles([])
      setF({ ...f, note: '' })
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row g-4">
      <div className={isFarmer && deal.status === 'active' ? 'col-lg-7' : 'col-12'}>
        <div className="fl-card p-4">
          <div className="d-flex gap-2 mb-4">
            {MILESTONES.map((m) => (
              <div key={m.key} className="flex-grow-1 text-center">
                <span className={`fl-icon-tile ${done.has(m.key) ? '' : 'soft opacity-50'}`} style={{ width: 44, height: 44 }}><i className={`bi ${done.has(m.key) ? 'bi-check-lg' : m.icon}`} /></span>
                <div className="small fw-semibold mt-1">{m.label}</div>
              </div>
            ))}
          </div>
          {milestones.length === 0 ? (
            <p className="text-muted-fl text-center mb-0">{deal.status === 'drafting' ? 'Season updates start once both parties confirm the agreement.' : 'No updates yet.'}</p>
          ) : (
            <ol className="list-unstyled fl-timeline mb-0">
              {milestones.map((m) => {
                const meta = MILESTONES.find((x) => x.key === m.milestone)
                return (
                  <li key={m.id} className="fl-timeline-item fl-swap">
                    <span className="fl-timeline-dot"><i className={`bi ${meta.icon}`} /></span>
                    <div className="fw-semibold">{meta.label} <span className="small text-muted-fl fw-normal">· {fmtDate(m.occurred_on)}</span></div>
                    {m.note && <p className="small mb-2">{m.note}</p>}
                    {m.photo_paths?.length > 0 && (
                      <div className="d-flex flex-wrap gap-2">
                        {m.photo_paths.map((p) => <Photo key={p} path={p} bucket="milestone-photos" className="rounded-3 object-fit-cover" style={{ width: 132, height: 96 }} />)}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
      {isFarmer && deal.status === 'active' && (
        <div className="col-lg-5">
          <form className="fl-card p-4" onSubmit={post}>
            <h3 className="h5">Post an update</h3>
            <p className="small text-muted-fl">The landowner is notified. Photos are compressed before upload.</p>
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <div className="d-grid gap-3">
              <Field label="Milestone" htmlFor="ms-type">
                <select id="ms-type" className="form-select" value={f.milestone} onChange={(e) => setF({ ...f, milestone: e.target.value })}>
                  {MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}{done.has(m.key) ? ' (another update)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Date" htmlFor="ms-date"><input id="ms-date" type="date" className="form-control" max={new Date().toISOString().slice(0, 10)} value={f.occurred_on} onChange={(e) => setF({ ...f, occurred_on: e.target.value })} /></Field>
              <Field label="What happened" htmlFor="ms-note"><textarea id="ms-note" className="form-control" rows={3} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
              <Field label="Photos" htmlFor="ms-photos"><input id="ms-photos" type="file" accept="image/*" multiple capture="environment" className="form-control" onChange={(e) => setFiles([...e.target.files].slice(0, 4))} /></Field>
              <button className="btn btn-primary" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Post update</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
