import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { uploadPhoto } from '../../../lib/storage'
import { PageHeader, Field, Loading, Photo } from '../../../components/ui'
import { MapPicker } from '../../../components/Maps'
import { REGIONS, SOIL_TYPES, WATER_ACCESS, CROPS } from '../../../lib/constants'

const EMPTY = {
  title: '', description: '', region: '', district: '', community: '', size_acres: '', soil_type: '', water_access: '',
  suitable_crops: [], latitude: null, longitude: null, available_from: '', min_duration_months: '',
}

// FR2: create or edit a plot with photos, map location and optional supporting documents.
export default function PlotForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [form, setForm] = useState({ ...EMPTY, region: profile.region || '', district: profile.district || '' })
  const [existing, setExisting] = useState([])
  const [newPhotos, setNewPhotos] = useState([])
  const [newDocs, setNewDocs] = useState([])
  const [removed, setRemoved] = useState([])
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!editing) return
    supabase.from('plots').select('*, plot_photos(*)').eq('id', id).single().then(({ data, error: err }) => {
      if (err) setError(errorMessage(err))
      else {
        setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? EMPTY[k]])) })
        setExisting((data.plot_photos || []).sort((a, b) => a.sort_order - b.sort_order))
        setStatus(data.status)
      }
      setLoading(false)
    })
  }, [editing, id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const toggleCrop = (c) => setForm({ ...form, suitable_crops: form.suitable_crops.includes(c) ? form.suitable_crops.filter((x) => x !== c) : [...form.suitable_crops, c] })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.region || !form.soil_type || !form.water_access) return setError('Choose the region, soil type and water access.')
    if (!(Number(form.size_acres) > 0)) return setError('Enter the plot size in acres.')
    if (!editing && newPhotos.length === 0) return setError('Add at least one photo of the plot.')
    setBusy(true)
    try {
      const row = {
        title: form.title.trim(), description: form.description || null, region: form.region, district: form.district || null,
        community: form.community || null, size_acres: Number(form.size_acres), soil_type: form.soil_type, water_access: form.water_access,
        suitable_crops: form.suitable_crops, latitude: form.latitude, longitude: form.longitude,
        available_from: form.available_from || null, min_duration_months: form.min_duration_months ? Number(form.min_duration_months) : null,
      }
      let plotId = id
      if (editing) {
        const { error: err } = await supabase.from('plots').update(row).eq('id', id)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('plots').insert({ ...row, owner_id: profile.id }).select('id').single()
        if (err) throw err
        plotId = data.id
      }
      for (const p of removed) {
        await supabase.from('plot_photos').delete().eq('id', p.id)
        if (!p.storage_path.startsWith('/')) await supabase.storage.from('plot-photos').remove([p.storage_path])
      }
      const start = existing.length
      const uploads = [...newPhotos.map((f) => [f, false]), ...newDocs.map((f) => [f, true])]
      for (let i = 0; i < uploads.length; i++) {
        const [file, isDoc] = uploads[i]
        const path = await uploadPhoto('plot-photos', plotId, file)
        const { error: err } = await supabase.from('plot_photos').insert({ plot_id: plotId, storage_path: path, is_document: isDoc, sort_order: start + i, uploaded_by: profile.id })
        if (err) throw err
      }
      navigate(`/plots/${plotId}`, { replace: true, state: { saved: true } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />
  const kept = existing.filter((p) => !removed.includes(p))

  return (
    <div className="fl-page" style={{ maxWidth: 900 }}>
      <PageHeader eyebrow="Landowner" title={editing ? 'Edit plot' : 'List a plot'}
        text={editing && status === 'verified' ? 'Changing size, location, soil or water sends the plot back for verification.' : 'A verifier will check the plot before farmers can see it.'} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <form onSubmit={submit} className="d-grid gap-4">
        <section className="fl-card p-4">
          <h2 className="h5 mb-3"><span className="text-muted-fl me-2">1</span>About the plot</h2>
          <div className="row g-3">
            <Field className="col-12" label="Title" htmlFor="pf-title" hint="e.g. Techiman roadside maize plot"><input id="pf-title" className="form-control" required minLength={3} maxLength={120} value={form.title} onChange={set('title')} /></Field>
            <Field className="col-12" label="Description" htmlFor="pf-desc" hint="Access road, past crops, anything a farmer should know."><textarea id="pf-desc" className="form-control" rows={3} maxLength={2000} value={form.description || ''} onChange={set('description')} /></Field>
            <div className="col-12">
              <span className="form-label d-block">Suitable crops</span>
              <div className="d-flex flex-wrap gap-2">
                {CROPS.map((c) => (
                  <button type="button" key={c} className={`fl-pill ${form.suitable_crops.includes(c) ? 'lime' : ''}`} aria-pressed={form.suitable_crops.includes(c)} onClick={() => toggleCrop(c)}>
                    {form.suitable_crops.includes(c) && <i className="bi bi-check-lg" />}{c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="fl-card p-4">
          <h2 className="h5 mb-3"><span className="text-muted-fl me-2">2</span>The land</h2>
          <div className="row g-3">
            <Field className="col-sm-4" label="Size (acres)" htmlFor="pf-size"><input id="pf-size" type="number" step="0.01" min="0.01" className="form-control" required value={form.size_acres} onChange={set('size_acres')} /></Field>
            <Field className="col-sm-4" label="Soil type" htmlFor="pf-soil">
              <select id="pf-soil" className="form-select" required value={form.soil_type} onChange={set('soil_type')}><option value="">Choose…</option>{SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field className="col-sm-4" label="Water access" htmlFor="pf-water">
              <select id="pf-water" className="form-select" required value={form.water_access} onChange={set('water_access')}><option value="">Choose…</option>{WATER_ACCESS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field className="col-sm-6" label="Available from" htmlFor="pf-from"><input id="pf-from" type="date" className="form-control" value={form.available_from || ''} onChange={set('available_from')} /></Field>
            <Field className="col-sm-6" label="Minimum duration (months)" htmlFor="pf-min"><input id="pf-min" type="number" min="1" max="120" className="form-control" value={form.min_duration_months || ''} onChange={set('min_duration_months')} /></Field>
          </div>
        </section>

        <section className="fl-card p-4">
          <h2 className="h5 mb-3"><span className="text-muted-fl me-2">3</span>Location</h2>
          <div className="row g-3 mb-3">
            <Field className="col-sm-4" label="Region" htmlFor="pf-region">
              <select id="pf-region" className="form-select" required value={form.region} onChange={set('region')}><option value="">Choose…</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field className="col-sm-4" label="District" htmlFor="pf-district"><input id="pf-district" className="form-control" value={form.district || ''} onChange={set('district')} /></Field>
            <Field className="col-sm-4" label="Town or community" htmlFor="pf-comm"><input id="pf-comm" className="form-control" value={form.community || ''} onChange={set('community')} /></Field>
          </div>
          <MapPicker value={[form.latitude, form.longitude]} onChange={([lat, lng]) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))} />
        </section>

        <section className="fl-card p-4">
          <h2 className="h5 mb-1"><span className="text-muted-fl me-2">4</span>Photos and documents</h2>
          <p className="small text-muted-fl">Photos are compressed on your phone before upload. Documents (e.g. an indenture or allocation note) are optional and only seen by verifiers and admins.</p>
          {kept.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mb-3">
              {kept.map((p) => (
                <div key={p.id} className="position-relative">
                  {p.is_document ? <div className="fl-card d-grid text-muted-fl" style={{ width: 110, height: 82, placeItems: 'center' }}><i className="bi bi-file-earmark-text fs-3" /></div>
                    : <Photo path={p.storage_path} bucket="plot-photos" className="rounded-3 object-fit-cover" style={{ width: 110, height: 82 }} />}
                  <button type="button" className="btn btn-sm btn-light position-absolute top-0 end-0 m-1 rounded-circle p-0" style={{ width: 24, height: 24 }} aria-label="Remove" onClick={() => setRemoved([...removed, p])}><i className="bi bi-x" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="row g-3">
            <Field className="col-md-6" label="Add photos" htmlFor="pf-photos">
              <input id="pf-photos" type="file" accept="image/*" multiple className="form-control" onChange={(e) => setNewPhotos([...e.target.files].slice(0, 8))} />
            </Field>
            <Field className="col-md-6" label="Supporting documents (optional)" htmlFor="pf-docs">
              <input id="pf-docs" type="file" accept="image/*,application/pdf" multiple className="form-control" onChange={(e) => setNewDocs([...e.target.files].slice(0, 4))} />
            </Field>
          </div>
          {newPhotos.length > 0 && <div className="small text-muted-fl mt-2">{newPhotos.length} photo{newPhotos.length > 1 ? 's' : ''} ready to upload</div>}
          <div className="alert alert-light border small mt-3 mb-0"><i className="bi bi-info-circle me-1" />Verification confirms the plot exists and matches this listing. It is not proof of land title.</div>
        </section>

        <div className="d-flex gap-2">
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}{editing ? 'Save changes' : 'Submit for verification'}</button>
          <button type="button" className="btn btn-outline-primary btn-lg" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
