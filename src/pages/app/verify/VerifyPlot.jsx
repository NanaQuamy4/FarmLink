import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useQuery } from '../../../lib/useQuery'
import { Loading, ErrorAlert, Photo, StatusBadge, Avatar, Field } from '../../../components/ui'
import { PlotMap } from '../../../components/Maps'
import { PLOT_STATUS } from '../../../lib/constants'
import { fmtNumber, displayName } from '../../../lib/format'
import { photoUrl } from '../../../lib/storage'

const CHECKS = [
  ['exists', 'The plot exists at the pinned location'],
  ['size_matches', 'Size roughly matches the listing'],
  ['soil_matches', 'Soil type matches'],
  ['water_matches', 'Water access matches'],
  ['phone_confirmed', 'Landowner confirmed by phone'],
  ['photos_match', 'Photos are of this plot'],
]

// FR9: verifier checklist, visit notes, approve or reject.
export default function VerifyPlot() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [checks, setChecks] = useState({})
  const [notes, setNotes] = useState('')
  const [visited, setVisited] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const { data, loading, error, reload } = useQuery(async () => {
    const { data: plot, error: e } = await supabase.from('plots')
      .select('*, plot_photos(*), owner:profiles!plots_owner_id_fkey(id, full_name, region, district, avatar_url, created_at)').eq('id', id).maybeSingle()
    if (e) throw e
    if (!plot) throw new Error('Plot not found or not in your regions.')
    const phone = await supabase.rpc('get_contact_phone', { p_user: plot.owner_id })
    return { plot, phone: phone.data }
  }, [id])

  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { plot, phone } = data
  const photos = plot.plot_photos.filter((p) => !p.is_document)
  const docs = plot.plot_photos.filter((p) => p.is_document)
  const allChecked = CHECKS.every(([k]) => checks[k])

  async function decide(approve) {
    if (!approve && !notes.trim()) return setErr('Write what needs fixing so the landowner can correct it.')
    setBusy(approve ? 'approve' : 'reject')
    setErr('')
    const { error: e } = await supabase.rpc('verify_plot', { p_plot: plot.id, p_approve: approve, p_checklist: checks, p_notes: notes || null, p_visited_on: visited || null })
    setBusy('')
    if (e) return setErr(errorMessage(e))
    navigate('/verify', { replace: true })
  }

  async function openDoc(path) {
    const url = await photoUrl(path, 'plot-photos')
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="fl-page">
      <Link to="/verify" className="small d-inline-block mb-3"><i className="bi bi-arrow-left me-1" />Verification queue</Link>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><h1 className="h2 mb-1">{plot.title}</h1><div className="text-muted-fl">{[plot.community, plot.district, plot.region].filter(Boolean).join(', ')}</div></div>
        <StatusBadge map={PLOT_STATUS} value={plot.status} />
      </div>

      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-4 align-content-start">
          <div className="row g-2">
            {photos.map((p) => <div className="col-6 col-md-4" key={p.id}><Photo path={p.storage_path} bucket="plot-photos" className="w-100 rounded-3 object-fit-cover" style={{ height: 130 }} /></div>)}
          </div>
          <section className="fl-card p-4">
            <h2 className="h5">Listed details</h2>
            <table className="table table-sm mb-0">
              <tbody>
                {[['Size', `${fmtNumber(plot.size_acres)} acres`], ['Soil', plot.soil_type], ['Water', plot.water_access], ['Crops', plot.suitable_crops.join(', ') || '–'],
                  ['Coordinates', plot.latitude != null ? `${plot.latitude}, ${plot.longitude}` : 'Not given']].map(([k, v]) => <tr key={k}><td className="text-muted-fl ps-0">{k}</td><td className="fw-semibold">{v}</td></tr>)}
              </tbody>
            </table>
            {plot.description && <p className="small mt-3 mb-0">{plot.description}</p>}
          </section>
          <PlotMap lat={plot.latitude} lng={plot.longitude} height={280} />
          {plot.latitude != null && (
            <a className="small" href={`https://www.google.com/maps/dir/?api=1&destination=${plot.latitude},${plot.longitude}`} target="_blank" rel="noreferrer">
              <i className="bi bi-sign-turn-right me-1" />Directions to the plot
            </a>
          )}
        </div>

        <div className="col-lg-5 d-grid gap-4 align-content-start">
          <section className="fl-card p-4">
            <div className="small text-muted-fl mb-2">Landowner</div>
            <div className="d-flex align-items-center gap-3">
              <Avatar profile={plot.owner} size={48} />
              <div className="flex-grow-1"><div className="fw-semibold">{displayName(plot.owner)}</div><div className="small text-muted-fl">{plot.owner.district}, {plot.owner.region}</div></div>
              {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="btn btn-outline-primary btn-sm"><i className="bi bi-telephone me-1" />{phone}</a>}
            </div>
            {docs.length > 0 && (
              <div className="mt-3 d-grid gap-1">
                <div className="small fw-semibold">Supporting documents</div>
                {docs.map((d, n) => <button key={d.id} type="button" className="btn btn-sm btn-light text-start" onClick={() => openDoc(d.storage_path)}><i className="bi bi-file-earmark-text me-1" />Document {n + 1}</button>)}
              </div>
            )}
          </section>

          {plot.status === 'pending' ? (
            <section className="fl-card p-4">
              <h2 className="h5">Checklist</h2>
              <div className="d-grid gap-2 mb-3">
                {CHECKS.map(([k, label]) => (
                  <div className="form-check" key={k}>
                    <input className="form-check-input" type="checkbox" id={`c-${k}`} checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
                    <label className="form-check-label" htmlFor={`c-${k}`}>{label}</label>
                  </div>
                ))}
              </div>
              <Field label="Date of visit or check" htmlFor="v-date" className="mb-3"><input id="v-date" type="date" className="form-control" value={visited} onChange={(e) => setVisited(e.target.value)} /></Field>
              <Field label="Notes" htmlFor="v-notes" hint="Required if you do not approve. The landowner sees this." className="mb-3">
                <textarea id="v-notes" className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              {err && <div className="alert alert-danger py-2">{err}</div>}
              <div className="d-grid gap-2">
                <button type="button" className="btn btn-primary btn-lg" disabled={!!busy || !allChecked} onClick={() => decide(true)}>
                  {busy === 'approve' && <span className="spinner-border spinner-border-sm me-2" />}<i className="bi bi-patch-check me-1" />Approve plot
                </button>
                {!allChecked && <div className="small text-muted-fl text-center">Tick every check to approve.</div>}
                <button type="button" className="btn btn-outline-danger" disabled={!!busy} onClick={() => decide(false)}>
                  {busy === 'reject' && <span className="spinner-border spinner-border-sm me-2" />}Send back to landowner
                </button>
              </div>
              <p className="small text-muted-fl mt-3 mb-0">Verification confirms the plot exists and matches the listing. It is not proof of title.</p>
            </section>
          ) : (
            <div className="alert alert-light border">This plot is no longer waiting for verification.</div>
          )}
        </div>
      </div>
    </div>
  )
}
