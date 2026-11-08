import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../../components/ui'
import { PlotCard, PLOT_SELECT } from '../../../components/cards'
import { PlotsMap } from '../../../components/Maps'
import { REGIONS, SOIL_TYPES, WATER_ACCESS, CROPS } from '../../../lib/constants'

// FR3: search verified plots by region, size, soil, water and suitable crop, as a list or on a map.
export default function FindLand() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('list')
  const f = {
    region: params.get('region') ?? (profile.region || ''),
    min: params.get('min') || '',
    max: params.get('max') || '',
    soil: params.get('soil') || '',
    water: params.get('water') || '',
    crop: params.get('crop') || '',
    q: params.get('q') || '',
  }
  const setF = (k, v) => {
    const next = new URLSearchParams(params)
    if (v === '' || v == null) next.delete(k)
    else next.set(k, v)
    if (k === 'region' && v === '') next.set('region', '')
    setParams(next, { replace: true })
  }

  const { data, loading, error, reload } = useQuery(() => {
    let q = supabase.from('plots').select(PLOT_SELECT).eq('status', 'verified').order('created_at', { ascending: false }).limit(200)
    if (f.region) q = q.eq('region', f.region)
    if (f.min) q = q.gte('size_acres', Number(f.min))
    if (f.max) q = q.lte('size_acres', Number(f.max))
    if (f.soil) q = q.eq('soil_type', f.soil)
    if (f.water) q = q.eq('water_access', f.water)
    if (f.crop) q = q.contains('suitable_crops', [f.crop])
    return q
  }, [f.region, f.min, f.max, f.soil, f.water, f.crop])

  const results = useMemo(() => {
    const term = f.q.trim().toLowerCase()
    return (data || []).filter((p) => p.owner_id !== profile.id && (!term || [p.title, p.district, p.community, p.description].join(' ').toLowerCase().includes(term)))
  }, [data, f.q, profile.id])

  const active = ['min', 'max', 'soil', 'water', 'crop', 'q'].filter((k) => f[k]).length + (f.region ? 1 : 0)

  return (
    <div className="fl-page">
      <PageHeader image="/images/open-farmland-sky.jpg" eyebrow="Find land" title="Verified land," accent="ready to farm." text="Every plot here has been checked by a verifier. Filter by region, size, soil, water and crop." />

      <div className="fl-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-3">
            <label className="form-label small" htmlFor="fl-q">Search</label>
            <div className="input-group"><span className="input-group-text bg-white"><i className="bi bi-search" /></span><input id="fl-q" className="form-control" placeholder="Town, district…" value={f.q} onChange={(e) => setF('q', e.target.value)} /></div>
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label small" htmlFor="fl-region">Region</label>
            <select id="fl-region" className="form-select" value={f.region} onChange={(e) => setF('region', e.target.value)}><option value="">All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label small">Size (acres)</label>
            <div className="d-flex gap-1">
              <input aria-label="Minimum acres" type="number" min="0" className="form-control" placeholder="Min" value={f.min} onChange={(e) => setF('min', e.target.value)} />
              <input aria-label="Maximum acres" type="number" min="0" className="form-control" placeholder="Max" value={f.max} onChange={(e) => setF('max', e.target.value)} />
            </div>
          </div>
          <div className="col-4 col-lg-1">
            <label className="form-label small" htmlFor="fl-soil">Soil</label>
            <select id="fl-soil" className="form-select" value={f.soil} onChange={(e) => setF('soil', e.target.value)}><option value="">Any</option>{SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="col-4 col-lg-2">
            <label className="form-label small" htmlFor="fl-water">Water</label>
            <select id="fl-water" className="form-select" value={f.water} onChange={(e) => setF('water', e.target.value)}><option value="">Any</option>{WATER_ACCESS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="col-4 col-lg-2">
            <label className="form-label small" htmlFor="fl-crop">Crop</label>
            <select id="fl-crop" className="form-select" value={f.crop} onChange={(e) => setF('crop', e.target.value)}><option value="">Any</option>{CROPS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="text-muted-fl">
          <strong className="text-body">{results.length}</strong> plot{results.length === 1 ? '' : 's'} found
          {active > 0 && <button type="button" className="btn btn-link btn-sm" onClick={() => setParams(new URLSearchParams({ region: '' }), { replace: true })}>Clear filters</button>}
        </div>
        <div className="btn-group" role="group" aria-label="View">
          <button type="button" className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('list')}><i className="bi bi-grid me-1" />List</button>
          <button type="button" className={`btn btn-sm ${view === 'map' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('map')}><i className="bi bi-map me-1" />Map</button>
        </div>
      </div>

      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : results.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-search" title="No plots match" text="Try another region or fewer filters." /></div>
      ) : view === 'map' ? (
        <PlotsMap plots={results} />
      ) : (
        <div className="row g-3">
          {results.map((p, i) => <div className="col-sm-6 col-xl-4 fl-swap" key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}><PlotCard plot={p} to={`/find/${p.id}`} showStatus={false} /></div>)}
        </div>
      )}
    </div>
  )
}
