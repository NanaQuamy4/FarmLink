import { useMemo, useState } from 'react'
import { calculateHarvestSplit } from '../lib/harvestSplit'

const fmt = (n) => n.toLocaleString('en-GH', { maximumFractionDigits: 2 })

// Interactive version of the FR8 harvest split rule, shown on the landing page.
export default function HarvestSplitDemo() {
  const [total, setTotal] = useState(42)
  const [pct, setPct] = useState(30)
  const [deduction, setDeduction] = useState(4)
  const [price, setPrice] = useState(450)

  const { result, error } = useMemo(() => {
    try {
      return { result: calculateHarvestSplit({ total, landownerPercent: pct, deduction, deductionTo: 'farmer', salePricePerUnit: price }) }
    } catch (e) {
      return { error: e.message }
    }
  }, [total, pct, deduction, price])

  return (
    <div className="row g-4 align-items-stretch">
      <div className="col-lg-6">
        <div className="fl-card p-4 p-md-5">
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label" htmlFor="hs-total">Harvest (bags)</label>
              <input id="hs-total" type="number" min="0" className="form-control" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="hs-ded">Input deduction (bags)</label>
              <input id="hs-ded" type="number" min="0" className="form-control" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label d-flex justify-content-between" htmlFor="hs-pct">
                <span>Agreed split</span>
                <span className="text-muted-fl">Landowner {pct}% · Farmer {100 - pct}%</span>
              </label>
              <input id="hs-pct" type="range" min="0" max="100" step="5" className="form-range" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="hs-price">Sale price per bag (GH₵, optional)</label>
              <input id="hs-price" type="number" min="0" className="form-control" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <p className="small text-muted-fl mt-3 mb-0">
            The deduction goes back to whoever supplied seed and fertiliser (here, the farmer) before the split.
          </p>
        </div>
      </div>
      <div className="col-lg-6">
        <div className="fl-section-dark fl-on-dark rounded-fl-xl p-4 p-md-5 h-100 d-flex flex-column">
          {error ? (
            <div className="alert alert-warning mb-0">{error}</div>
          ) : (
            <>
              <div className="d-flex justify-content-between small mb-2">
                <span>Landowner</span><span>Farmer</span>
              </div>
              <div className="progress mb-4" style={{ height: 14, background: 'rgba(255,255,255,.12)' }} role="img"
                aria-label={`Landowner ${fmt(result.landownerShare)} bags, farmer ${fmt(result.farmerShare)} bags`}>
                <div className="progress-bar" style={{ width: `${result.total ? (result.landownerShare / result.total) * 100 : 0}%`, background: 'var(--fl-leaf)' }} />
                <div className="progress-bar" style={{ width: `${result.total ? (result.farmerShare / result.total) * 100 : 0}%`, background: 'var(--fl-lime)' }} />
              </div>
              <div className="row g-3 flex-grow-1">
                <div className="col-6">
                  <div className="fl-card-dark">
                    <div className="small mb-2"><i className="bi bi-house-door me-1" />Landowner</div>
                    <div className="fl-stat">{fmt(result.landownerShare)}</div>
                    <div className="small mt-1">bags</div>
                    {result.landownerValue !== undefined && <div className="text-lime fw-semibold mt-2">GH₵ {fmt(result.landownerValue)}</div>}
                  </div>
                </div>
                <div className="col-6">
                  <div className="fl-card-dark">
                    <div className="small mb-2"><i className="bi bi-person-workspace me-1" />Farmer</div>
                    <div className="fl-stat">{fmt(result.farmerShare)}</div>
                    <div className="small mt-1">bags (incl. {fmt(result.deduction)} deduction)</div>
                    {result.farmerValue !== undefined && <div className="text-lime fw-semibold mt-2">GH₵ {fmt(result.farmerValue)}</div>}
                  </div>
                </div>
              </div>
              <p className="small mt-4 mb-0 text-muted-fl">
                {fmt(result.total)} bags − {fmt(result.deduction)} deduction = {fmt(result.remaining)} bags split {pct}/{100 - pct}.
                FarmLink records the split. It does not move money.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
