import { useRef, useState } from 'react'
import { calculateHarvestSplit } from '../lib/harvestSplit'

// Interactive tour of the core features (FR2–FR11). Each tab shows a small mock of the real screen.
// Names in the mocks are illustrative examples.

const Check = ({ done = true, children }) => (
  <div className="d-flex align-items-center gap-2 py-1">
    <i className={`bi ${done ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted-fl'}`} />
    <span className={done ? '' : 'text-muted-fl'}>{children}</span>
  </div>
)

function ListVerify() {
  return (
    <div className="fl-stage-panel row g-3">
      <div className="col-md-7">
        <div className="fl-mock fl-mock-sm">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>New plot listing</strong><span className="fl-status pending">Awaiting check</span>
          </div>
          <div className="row g-2">
            {[['Size', '2.5 acres'], ['Region', 'Bono East'], ['Soil', 'Loamy'], ['Water', 'Stream nearby']].map(([k, v]) => (
              <div className="col-6" key={k}><div className="text-muted-fl">{k}</div><div className="fw-semibold">{v}</div></div>
            ))}
          </div>
          <div className="d-flex gap-2 mt-3">
            {['idle-land-green', 'idle-land-dry', 'corn-field'].map((p) => (
              <img key={p} src={`/images/${p}.jpg`} alt="" className="rounded-3 object-fit-cover" style={{ width: 64, height: 48 }} loading="lazy" />
            ))}
            <span className="d-grid place-items-center rounded-3 border text-muted-fl" style={{ width: 64, height: 48, placeItems: 'center', display: 'grid' }}><i className="bi bi-plus-lg" /></span>
          </div>
        </div>
      </div>
      <div className="col-md-5">
        <div className="fl-mock fl-mock-sm h-100">
          <div className="d-flex align-items-center gap-2 mb-2"><i className="bi bi-person-badge text-deep" /><strong>Verifier visit</strong></div>
          <Check>Plot exists at the pinned location</Check>
          <Check>Size and soil match the listing</Check>
          <Check>Landowner phone confirmed</Check>
          <div className="mt-2"><span className="fl-status verified">Verified · now visible to farmers</span></div>
        </div>
      </div>
      <p className="small mb-0" style={{ opacity: 0.75 }}>Verification confirms the plot exists and matches its listing. It is not proof of title.</p>
    </div>
  )
}

function SearchMap() {
  const pins = [[22, 38, false], [48, 62, true], [70, 30, false], [82, 70, false], [35, 80, false]]
  return (
    <div className="fl-stage-panel d-grid gap-3">
      <div className="d-flex flex-wrap gap-2">
        {['Bono East', '1–5 acres', 'Loamy', 'Water access', 'Maize'].map((f) => (
          <span className="fl-pill lime" key={f}><i className="bi bi-funnel" />{f}</span>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-md-7">
          <div className="fl-map">
            <div className="fl-river" />
            {pins.map(([x, y, hot], n) => (
              <i key={n} className={`bi bi-geo-alt-fill fl-pin${hot ? ' hot' : ''}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${n * 0.08}s` }} />
            ))}
          </div>
        </div>
        <div className="col-md-5 d-grid gap-2">
          {[['2.5 acres · Techiman', 'Loamy · Stream', 'corn-field'], ['4 acres · Kintampo', 'Sandy loam · Borehole', 'crop-rows']].map(([t, d, img]) => (
            <div className="fl-mock fl-mock-sm d-flex gap-2 align-items-center" key={t}>
              <img src={`/images/${img}.jpg`} alt="" className="rounded-3 object-fit-cover" style={{ width: 56, height: 56 }} loading="lazy" />
              <div><div className="fw-semibold">{t}</div><div className="text-muted-fl">{d}</div><span className="fl-status verified mt-1">Verified</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Apply() {
  return (
    <div className="fl-stage-panel row g-3">
      <div className="col-md-6">
        <div className="fl-mock fl-mock-sm">
          <strong className="d-block mb-2">Apply for this plot</strong>
          <div className="text-muted-fl">Applying as</div>
          <div className="fw-semibold mb-2"><i className="bi bi-people me-1" />Nkoranza Youth Farmers · 6 members</div>
          <div className="text-muted-fl">Planned crop</div>
          <div className="fw-semibold mb-2">Maize, one season</div>
          <div className="text-muted-fl">Message</div>
          <div className="border rounded-3 p-2 mb-3">We have farmed maize for three seasons and can supply our own seed.</div>
          <span className="btn btn-primary btn-sm w-100">Send application</span>
        </div>
      </div>
      <div className="col-md-6">
        <div className="fl-mock fl-mock-sm h-100">
          <strong className="d-block mb-2">Application status</strong>
          <Check>Sent to landowner</Check>
          <Check>Viewed</Check>
          <Check>Accepted · deal opened</Check>
          <Check done={false}>Agreement confirmed</Check>
          <div className="mt-2 text-muted-fl">The landowner can compare all applicants before accepting one.</div>
        </div>
      </div>
    </div>
  )
}

function Chat() {
  return (
    <div className="fl-stage-panel">
      <div className="fl-mock fl-mock-sm mx-auto" style={{ maxWidth: 460 }}>
        <div className="d-flex align-items-center gap-2 pb-2 mb-3 border-bottom">
          <span className="fl-icon-tile soft" style={{ width: 36, height: 36, fontSize: '1rem' }}><i className="bi bi-person" /></span>
          <div><div className="fw-semibold">Ama Owusu · Landowner</div><div className="text-muted-fl"><i className="bi bi-lock-fill me-1" />Private to this deal</div></div>
        </div>
        <div className="d-grid gap-2">
          <div className="fl-bubble them">Hello Kwame, when can you come and see the plot?</div>
          <div className="fl-bubble me">Saturday morning works. Is the stream flowing all year?</div>
          <div className="fl-bubble them">It slows in January but never dries up.</div>
          <div className="fl-bubble me">Great. I’ll draft the agreement after the visit.</div>
          <div className="fl-typing ps-1"><span /><span /><span /></div>
        </div>
      </div>
    </div>
  )
}

function Agreement() {
  return (
    <div className="fl-stage-panel row g-3">
      <div className="col-md-7">
        <div className="fl-mock fl-mock-sm">
          <div className="d-flex justify-content-between mb-2"><strong>Agreement summary</strong><span className="text-muted-fl">Version 2</span></div>
          <table className="table table-sm mb-0 small">
            <tbody>
              {[['Crop', 'Maize'], ['Duration', 'Apr – Sep 2026 (1 season)'], ['Seed & fertiliser', 'Farmer'], ['Land clearing', 'Landowner'], ['Harvest split', '30% landowner · 70% farmer'], ['Input deduction', '4 bags to farmer before split']].map(([k, v]) => (
                <tr key={k}><td className="text-muted-fl ps-0">{k}</td><td className="fw-semibold pe-0">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="col-md-5 d-grid gap-2 align-content-start">
        <div className="fl-mock fl-mock-sm d-flex align-items-center gap-2"><i className="bi bi-check-circle-fill text-success fs-5" /><div><div className="fw-semibold">Ama Owusu</div><div className="text-muted-fl">Confirmed 12 Mar</div></div></div>
        <div className="fl-mock fl-mock-sm d-flex align-items-center gap-2"><i className="bi bi-check-circle-fill text-success fs-5" /><div><div className="fw-semibold">Kwame Asante</div><div className="text-muted-fl">Confirmed 12 Mar</div></div></div>
        <p className="small mb-0" style={{ opacity: 0.75 }}>Any change creates a new version that both parties confirm again. A record, not a legal contract.</p>
      </div>
    </div>
  )
}

function Season() {
  const steps = [['Cleared', 'idle-land-dry', '2 Apr'], ['Planted', 'crop-rows', '19 Apr'], ['Weeded', 'farmers-weeding', '30 May'], ['Harvested', 'maize-harvest', '']]
  return (
    <div className="fl-stage-panel d-grid gap-3">
      <div className="row g-3">
        {steps.map(([name, img, date], n) => (
          <div className="col-6 col-md-3" key={name}>
            <div className="fl-mock fl-mock-sm p-2 h-100">
              <div className="position-relative">
                <img src={`/images/${img}.jpg`} alt="" className="w-100 rounded-3 object-fit-cover" style={{ height: 90, filter: date ? 'none' : 'grayscale(1) opacity(.45)' }} loading="lazy" />
                <span className="position-absolute top-0 start-0 m-1 badge rounded-pill" style={{ background: date ? 'var(--fl-lime)' : '#fff', color: 'var(--fl-deep)' }}>{n + 1}</span>
              </div>
              <div className="fw-semibold mt-2">{name}</div>
              <div className="text-muted-fl">{date ? <><i className="bi bi-camera me-1" />Photo · {date}</> : 'Expected Sep'}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="d-flex align-items-center gap-3">
        <div className="progress flex-grow-1" style={{ height: 8, background: 'rgba(255,255,255,.15)' }}><div className="progress-bar" style={{ width: '75%', background: 'var(--fl-lime)' }} /></div>
        <span className="small">3 of 4 milestones</span>
      </div>
    </div>
  )
}

function Harvest() {
  const r = calculateHarvestSplit({ total: 42, landownerPercent: 30, deduction: 4, deductionTo: 'farmer', salePricePerUnit: 450 })
  return (
    <div className="fl-stage-panel row g-3 align-items-stretch">
      <div className="col-md-5">
        <div className="fl-mock fl-mock-sm h-100">
          <strong className="d-block mb-2">Record harvest</strong>
          <div className="text-muted-fl">Yield</div><div className="fw-semibold mb-2">42 bags of maize</div>
          <div className="text-muted-fl">Sold at</div><div className="fw-semibold mb-2">GH₵ 450 per bag</div>
          <div className="text-muted-fl">Photo</div>
          <img src="/images/maize-harvest.jpg" alt="" className="w-100 rounded-3 object-fit-cover" style={{ height: 70 }} loading="lazy" />
        </div>
      </div>
      <div className="col-md-7 d-grid gap-2">
        {[['Landowner', r.landownerShare, r.landownerValue, 'bi-house-door'], ['Farmer', r.farmerShare, r.farmerValue, 'bi-person-workspace']].map(([who, bags, cedis, icon]) => (
          <div className="fl-card-dark d-flex align-items-center justify-content-between" key={who}>
            <div><div className="small"><i className={`bi ${icon} me-1`} />{who}</div><div className="fl-stat">{bags}</div><div className="small">bags</div></div>
            <div className="text-lime fw-semibold fs-5">GH₵ {cedis.toLocaleString('en-GH')}</div>
          </div>
        ))}
        <a href="#calculator" className="small link-light">Try the calculator yourself <i className="bi bi-arrow-down" /></a>
      </div>
    </div>
  )
}

function Disputes() {
  return (
    <div className="fl-stage-panel row g-3">
      <div className="col-md-7">
        <div className="fl-mock fl-mock-sm">
          <div className="d-flex justify-content-between align-items-center mb-2"><strong>Dispute #014</strong><span className="fl-status pending">In mediation</span></div>
          <div className="text-muted-fl">Raised by Kwame Asante</div>
          <p className="mb-2">“Land clearing was agreed as the landowner’s job but was not done before planting.”</p>
          <div className="text-muted-fl mb-1">Evidence attached automatically</div>
          <div className="d-flex flex-wrap gap-2">
            <span className="fl-pill"><i className="bi bi-file-earmark-text" />Agreement v2</span>
            <span className="fl-pill"><i className="bi bi-image" />Cleared · 2 Apr</span>
            <span className="fl-pill"><i className="bi bi-chat-dots" />Chat history</span>
          </div>
        </div>
      </div>
      <div className="col-md-5">
        <div className="fl-mock fl-mock-sm h-100">
          <div className="d-flex align-items-center gap-2 mb-2"><i className="bi bi-person-badge text-deep" /><strong>Abena Mensah · Verifier</strong></div>
          <p className="mb-2">Agreement v2 lists clearing under the landowner. Proposed: landowner covers 2 bags of the farmer’s input costs.</p>
          <div className="d-flex gap-2"><span className="btn btn-sm btn-primary">Accept</span><span className="btn btn-sm btn-outline-primary">Respond</span></div>
        </div>
      </div>
    </div>
  )
}

function Notifications() {
  const items = [
    ['bi-person-plus', 'New application', 'Nkoranza Youth Farmers applied for your Techiman plot', '2 min'],
    ['bi-chat-dots', 'New message', 'Ama Owusu: “Saturday morning is fine.”', '1 h'],
    ['bi-patch-check', 'Plot verified', 'Your 2.5 acre plot is now visible to farmers', '3 h'],
    ['bi-flag', 'Milestone posted', 'Kwame marked the plot as Weeded, with 2 photos', '1 d'],
  ]
  return (
    <div className="fl-stage-panel">
      <div className="fl-mock fl-mock-sm mx-auto" style={{ maxWidth: 480 }}>
        <div className="d-flex justify-content-between mb-2"><strong>Notifications</strong><span className="badge rounded-pill bg-primary">4 new</span></div>
        {items.map(([icon, t, d, when]) => (
          <div className="d-flex gap-2 py-2 border-top" key={t}>
            <span className="fl-icon-tile soft" style={{ width: 34, height: 34, fontSize: '.95rem' }}><i className={`bi ${icon}`} /></span>
            <div className="flex-grow-1"><div className="fw-semibold">{t}</div><div className="text-muted-fl">{d}</div></div>
            <span className="text-muted-fl text-nowrap">{when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Reports() {
  return (
    <div className="fl-stage-panel row g-3">
      <div className="col-12">
        <div className="row g-2">
          {[['Users', '248'], ['Verified plots', '61'], ['Active deals', '34'], ['Open disputes', '3']].map(([k, v]) => (
            <div className="col-6 col-md-3" key={k}><div className="fl-mock fl-mock-sm"><div className="text-muted-fl">{k}</div><div className="fs-4 fw-semibold" style={{ fontFamily: 'Outfit' }}>{v}</div></div></div>
          ))}
        </div>
      </div>
      <div className="col-md-8">
        <div className="fl-mock fl-mock-sm">
          <div className="d-flex justify-content-between mb-2"><strong>Deals started per month</strong><span className="text-muted-fl">Sample data</span></div>
          <div className="fl-bar-chart">
            {[35, 50, 42, 68, 80, 62, 90].map((h, n) => <span key={n} style={{ height: `${h}%`, animationDelay: `${n * 0.06}s` }} />)}
          </div>
        </div>
      </div>
      <div className="col-md-4 d-grid gap-2 align-content-start">
        <span className="btn btn-lime"><i className="bi bi-file-earmark-pdf me-1" />Export PDF</span>
        <span className="btn btn-outline-light-fl"><i className="bi bi-file-earmark-excel me-1" />Export Excel</span>
        <p className="small mb-0" style={{ opacity: 0.75 }}>Administrators see users, plots, deals and disputes across all regions.</p>
      </div>
    </div>
  )
}

const features = [
  { id: 'list', fr: 'FR2 · FR9', icon: 'bi-geo-alt', title: 'List & verify plots', text: 'Photos, size, soil, water and map location, checked by a verifier before going live.', Panel: ListVerify },
  { id: 'search', fr: 'FR3', icon: 'bi-search', title: 'Search on the map', text: 'Filter verified plots by region, size, soil, water and suitable crop.', Panel: SearchMap },
  { id: 'apply', fr: 'FR4', icon: 'bi-send', title: 'Apply alone or as a group', text: 'Farmers and farmer groups apply; landowners compare and accept.', Panel: Apply },
  { id: 'chat', fr: 'FR5', icon: 'bi-chat-dots', title: 'Private deal chat', text: 'One-to-one messages in real time, visible only to the two parties.', Panel: Chat },
  { id: 'agree', fr: 'FR6', icon: 'bi-file-earmark-check', title: 'Agreement builder', text: 'Crop, duration, inputs and split in one summary both parties confirm.', Panel: Agreement },
  { id: 'season', fr: 'FR7', icon: 'bi-flower2', title: 'Season tracker', text: 'Cleared, planted, weeded, harvested, each with dated photos.', Panel: Season },
  { id: 'harvest', fr: 'FR8', icon: 'bi-pie-chart', title: 'Harvest split', text: 'Record the yield; each share is calculated from the agreed terms.', Panel: Harvest },
  { id: 'disputes', fr: 'FR9', icon: 'bi-shield-check', title: 'Disputes & mediation', text: 'A verifier mediates using the agreement, photos and chat on record.', Panel: Disputes },
  { id: 'notify', fr: 'FR10', icon: 'bi-bell', title: 'Notifications', text: 'Alerts for applications, messages, verification and milestones.', Panel: Notifications },
  { id: 'reports', fr: 'FR11', icon: 'bi-bar-chart', title: 'Admin reports', text: 'Dashboard of users, plots, deals and disputes, exportable to PDF and Excel.', Panel: Reports },
]

export default function FeatureShowcase() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef([])
  const { Panel } = features[active]

  const onKeyDown = (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (!(e.key in keys)) return
    e.preventDefault()
    const next = (active + keys[e.key] + features.length) % features.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section id="features" className="fl-section container">
      <div className="row g-4 align-items-end mb-5">
        <div className="col-lg-6" data-reveal>
          <span className="fl-eyebrow mb-3">Features</span>
          <h2 className="fl-h-section mb-0">Everything a land partnership <span className="fl-serif text-deep">needs on record</span></h2>
        </div>
        <div className="col-lg-5 offset-lg-1" data-reveal style={{ '--i': 1 }}>
          <p className="fl-lead mb-0">Pick a feature to see how it works, from the first listing to the admin’s report.</p>
        </div>
      </div>
      <div className="row g-4" data-reveal style={{ '--i': 2 }}>
        <div className="col-lg-4">
          <div className="fl-feature-tabs" role="tablist" aria-label="FarmLink features" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {features.map((f, n) => (
              <button
                key={f.id}
                ref={(el) => { tabRefs.current[n] = el }}
                type="button"
                role="tab"
                id={`tab-${f.id}`}
                aria-selected={n === active}
                aria-controls={`panel-${f.id}`}
                tabIndex={n === active ? 0 : -1}
                className={`fl-feature-tab${n === active ? ' active' : ''}`}
                onClick={() => setActive(n)}
              >
                <span className="fl-icon-tile"><i className={`bi ${f.icon}`} /></span>
                <span>
                  <span className="fl-tab-title d-block">{f.title}</span>
                  <span className="fl-tab-text">{f.text}</span>
                </span>
                <span className="fl-fr">{f.fr}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="col-lg-8">
          <div className="fl-stage fl-stage-sticky fl-on-dark" role="tabpanel" id={`panel-${features[active].id}`} aria-labelledby={`tab-${features[active].id}`}>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <div className="small text-lime fw-semibold">{features[active].fr}</div>
                <h3 className="h4 text-white mb-0">{features[active].title}</h3>
              </div>
              <span className="small" style={{ opacity: 0.7 }}>{active + 1} / {features.length}</span>
            </div>
            <Panel key={features[active].id} />
          </div>
        </div>
      </div>
    </section>
  )
}
