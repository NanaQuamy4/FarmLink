import { useMemo, useState } from 'react'
import { supabase, errorMessage } from '../../../lib/supabase'
import { calculateHarvestSplit } from '../../../lib/harvestSplit'
import { uploadPhoto } from '../../../lib/storage'
import { ActionButton, Field, Photo } from '../../../components/ui'
import { fmtNumber, fmtCedis, fmtDate, displayName } from '../../../lib/format'

function SplitView({ unit, landowner, farmer, landownerValue, farmerValue, deal, total, deduction, deductionTo }) {
  const pct = total ? (landowner / total) * 100 : 0
  return (
    <div className="fl-section-dark fl-on-dark rounded-fl-xl p-4">
      <div className="progress mb-4" style={{ height: 14, background: 'rgba(255,255,255,.12)' }} aria-hidden="true">
        <div className="progress-bar" style={{ width: `${pct}%`, background: 'var(--fl-ochre)' }} />
        <div className="progress-bar" style={{ width: `${100 - pct}%`, background: 'var(--fl-lime)' }} />
      </div>
      <div className="row g-3">
        {[['bi-house-door', `Landowner · ${displayName(deal.landowner)}`, landowner, landownerValue], ['bi-person-workspace', `Farmer · ${displayName(deal.farmer)}`, farmer, farmerValue]].map(([icon, who, q, v]) => (
          <div className="col-sm-6" key={who}>
            <div className="fl-card-dark">
              <div className="small mb-2"><i className={`bi ${icon} me-1`} />{who}</div>
              <div className="fl-stat">{fmtNumber(q)}</div>
              <div className="small">{unit}</div>
              {v != null && <div className="text-lime fw-semibold mt-2">{fmtCedis(v)}</div>}
            </div>
          </div>
        ))}
      </div>
      <p className="small mt-3 mb-0" style={{ opacity: 0.75 }}>
        {fmtNumber(total)} {unit}{Number(deduction) > 0 ? ` − ${fmtNumber(deduction)} deduction to the ${deductionTo}` : ''}, split by the agreement. FarmLink records the split. It does not move money.
      </p>
    </div>
  )
}

// FR8: record the harvest; shares are calculated in the database from the agreement in force.
export default function HarvestTab({ deal, harvest, current, isFarmer, isLandowner, reload }) {
  const [f, setF] = useState({ total: '', price: '', notes: '' })
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')

  const preview = useMemo(() => {
    if (!current || f.total === '') return null
    try {
      return calculateHarvestSplit({ total: f.total, landownerPercent: current.landowner_percent, deduction: Math.min(Number(current.deduction_amount), Number(f.total) || 0), deductionTo: current.deduction_to, salePricePerUnit: f.price === '' ? null : f.price })
    } catch { return null }
  }, [f, current])

  async function record() {
    setErr('')
    try {
      const photo = file ? await uploadPhoto('milestone-photos', deal.id, file) : null
      const { error } = await supabase.rpc('record_harvest', { p_deal: deal.id, p_total: Number(f.total), p_sale_price_per_unit: f.price === '' ? null : Number(f.price), p_notes: f.notes || null, p_photo_path: photo })
      if (error) throw error
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }
  async function complete() {
    const { error } = await supabase.rpc('complete_deal', { p_deal: deal.id })
    if (error) return setErr(errorMessage(error))
    reload()
  }

  if (harvest) {
    return (
      <div className="row g-4">
        <div className="col-lg-8">
          <SplitView unit={harvest.unit} landowner={harvest.landowner_share} farmer={harvest.farmer_share} landownerValue={harvest.landowner_value} farmerValue={harvest.farmer_value}
            deal={deal} total={harvest.total_quantity} deduction={harvest.deduction_applied} deductionTo={current?.deduction_to} />
        </div>
        <div className="col-lg-4 d-grid gap-3 align-content-start">
          <div className="fl-card p-4">
            <div className="small text-muted-fl">Recorded {fmtDate(harvest.created_at)}</div>
            <div className="fw-semibold mb-2">{fmtNumber(harvest.total_quantity)} {harvest.unit}{harvest.sale_price_per_unit != null && ` at ${fmtCedis(harvest.sale_price_per_unit)} each`}</div>
            {harvest.notes && <p className="small mb-2">{harvest.notes}</p>}
            {harvest.photo_path && <Photo path={harvest.photo_path} bucket="milestone-photos" className="w-100 rounded-3 object-fit-cover" style={{ height: 140 }} />}
          </div>
          {err && <div className="alert alert-danger mb-0">{err}</div>}
          {deal.status === 'harvested' && isLandowner && (
            <ActionButton className="btn btn-primary btn-lg" confirm="Confirm you received your share? This completes the season and lists the plot again." onClick={complete}>
              <i className="bi bi-check2-all me-1" />Confirm share received
            </ActionButton>
          )}
          {deal.status === 'harvested' && !isLandowner && <p className="small text-muted-fl">Waiting for the landowner to confirm they received their share.</p>}
        </div>
      </div>
    )
  }

  if (!current) return <div className="fl-card p-4 text-muted-fl">The harvest can be recorded once both parties confirm the agreement.</div>
  if (!isFarmer) return <div className="fl-card p-4 text-muted-fl">The farmer records the harvest. Your share will be calculated from the agreement: {fmtNumber(current.landowner_percent)}% to the landowner.</div>

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="fl-card p-4">
          <h3 className="h5">Record the harvest</h3>
          <p className="small text-muted-fl">This can only be done once. Check the total with the landowner first.</p>
          {err && <div className="alert alert-danger py-2">{err}</div>}
          <div className="d-grid gap-3">
            <Field label={`Total harvest (${current.harvest_unit})`} htmlFor="h-total"><input id="h-total" type="number" min="0" step="0.1" className="form-control form-control-lg" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
            <Field label="Sale price per unit (GH₵, optional)" htmlFor="h-price" hint="Shows the cash value of each share if the produce is sold."><input id="h-price" type="number" min="0" step="0.01" className="form-control" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field label="Notes" htmlFor="h-notes"><textarea id="h-notes" className="form-control" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            <Field label="Photo of the harvest" htmlFor="h-photo"><input id="h-photo" type="file" accept="image/*" capture="environment" className="form-control" onChange={(e) => setFile(e.target.files[0] || null)} /></Field>
            <ActionButton className="btn btn-primary btn-lg" disabled={f.total === '' || !preview} confirm="Record this harvest? It cannot be changed afterwards." onClick={record}>Record harvest</ActionButton>
          </div>
        </div>
      </div>
      <div className="col-lg-7">
        {preview ? (
          <SplitView unit={current.harvest_unit} landowner={preview.landownerShare} farmer={preview.farmerShare} landownerValue={preview.landownerValue} farmerValue={preview.farmerValue}
            deal={deal} total={preview.total} deduction={preview.deduction} deductionTo={current.deduction_to} />
        ) : (
          <div className="fl-card p-4 h-100 d-grid text-center text-muted-fl" style={{ placeItems: 'center' }}>
            <div><i className="bi bi-calculator fs-1 d-block mb-2" />Enter the total to preview each share.</div>
          </div>
        )}
      </div>
    </div>
  )
}
