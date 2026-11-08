import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import HarvestSplitDemo from '../components/HarvestSplitDemo'
import CountUp from '../components/CountUp'
import { useReveal } from '../lib/useReveal'
import { useRotator } from '../lib/useRotator'
import { calculateHarvestSplit } from '../lib/harvestSplit'
import FeatureShowcase from '../components/FeatureShowcase'

// Hero slides. pos / posLg keep the person clear of the headline on phones and desktops.
// Each slide's floating cards describe an example plot and split for that crop.
const slides = [
  {
    src: '/images/hero-pineapple-farm.jpg',
    alt: 'A smiling woman in a lime shirt presenting her pineapple farm',
    pos: '80% center', posLg: 'center center',
    plot: { size: '3 acres', place: 'Ekumfi', detail: 'Sandy loam · Borehole' },
    split: { crop: 'pineapples', unit: 'fruits', total: 1200, pct: 30 },
  },
  {
    src: '/images/hero-vegetable-crate.jpg',
    alt: 'A smiling farmer carrying a crate of fresh vegetables along a farm road',
    pos: '72% 30%', posLg: 'center 30%',
    plot: { size: '1.5 acres', place: 'Akuapem', detail: 'Clay loam · Irrigated' },
    split: { crop: 'vegetables', unit: 'crates', total: 60, pct: 25 },
  },
  {
    src: '/images/hero-farmer-maize.jpg',
    alt: 'A smiling young farmer with a hoe showing his healthy green maize field',
    pos: '74% 0%', posLg: 'center 0%',
    plot: { size: '2.5 acres', place: 'Techiman', detail: 'Loamy soil · Stream nearby' },
    split: { crop: 'maize', unit: 'bags', total: 42, pct: 30 },
  },
]

const steps = [
  { icon: 'bi-geo-alt', title: 'List and verify', text: 'A landowner lists an idle plot with photos, size, soil and water access. A verifier checks it before farmers can see it.' },
  { icon: 'bi-chat-dots', title: 'Match and chat', text: 'Farmers and farmer groups search by region, size, soil and crop, apply, and talk privately with the landowner.' },
  { icon: 'bi-file-earmark-check', title: 'Agree the terms', text: 'Both parties fill in duration, crop, who supplies inputs and the harvest split, then each confirms the summary.' },
  { icon: 'bi-graph-up-arrow', title: 'Track and share', text: 'The farmer posts cleared, planted, weeded and harvested updates with photos. The yield is split automatically.' },
]

const regions = ['Ashanti', 'Bono East', 'Northern', 'Volta', 'Eastern', 'Bono', 'Upper East', 'Central']

const modules = [
  { icon: 'bi-camera-video', title: 'Education sessions', text: 'Register for expert-led video sessions and keep the notes afterwards.', img: '/images/farmer-tablet.jpg' },
  { icon: 'bi-people', title: 'Farmer groups', text: 'Join groups by region or crop, with group chat and a notice board.', img: '/images/farmers-weeding.jpg' },
  { icon: 'bi-basket', title: 'Produce marketplace', text: 'List your harvest and accept or decline offers from buyers.', img: '/images/market-okro-seller.jpg' },
  { icon: 'bi-star', title: 'Ratings & profiles', text: 'Public profiles show completed seasons, sessions attended and ratings.', img: '/images/irrigating-farm.jpg' },
]

const faqs = [
  { q: 'Is a FarmLink agreement a legal contract?', a: 'No. The agreement is a record of the terms both parties confirmed on the platform, such as crop, duration, inputs and harvest split. It helps prevent misunderstanding and gives a verifier something clear to refer to in a dispute, but it is not a legally binding contract.' },
  { q: 'Does plot verification prove that someone owns the land?', a: 'No. A verifier, usually an extension officer or an approved community verifier such as a farmer association leader, confirms the plot exists and matches its listing. It does not replace the Lands Commission or title registration.' },
  { q: 'Who are the verifiers?', a: 'Extension officers where one is available. Where none is, the administrator approves community verifiers such as farmer association leaders or assembly members. Verifiers check plots and mediate disputes.' },
  { q: 'Does FarmLink handle payments?', a: 'No. FarmLink records the harvest and calculates each party’s share in bags or kilograms, and its cash value if the produce is sold. Payment happens outside the platform.' },
  { q: 'Can a group of young farmers apply together?', a: 'Yes. A farmer account can be set up as a farmer group with a group name and member count, and apply for plots as one party.' },
]

const i = (n) => ({ '--i': n })

export default function Landing() {
  useReveal()
  const [slide, goTo] = useRotator(slides.length, 7000)
  const [heroReady, setHeroReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeroReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const current = slides[slide]
  const heroSplit = calculateHarvestSplit({ total: current.split.total, landownerPercent: current.split.pct })

  return (
    <>
      <SiteNav overlay />

      {/* ---------- Hero ---------- */}
      <header className="position-relative p-2 p-md-3">
        <div className="position-relative overflow-hidden rounded-fl-xl text-white" style={{ minHeight: 'min(92vh, 860px)', isolation: 'isolate' }}>
          {slides.map((sl, n) => (
            <img
              key={sl.src}
              src={sl.src}
              alt={n === slide ? sl.alt : ''}
              aria-hidden={n !== slide}
              className={`position-absolute top-0 start-0 fl-cover fl-hero-slide${n === slide && heroReady ? ' active' : ''}`}
              style={{ zIndex: -2, '--pos': sl.pos, '--pos-lg': sl.posLg }}
              fetchpriority={n === 0 ? 'high' : undefined}
              decoding="async"
            />
          ))}
          <div className="position-absolute top-0 start-0 w-100 h-100 fl-hero-shade" style={{ zIndex: -1 }} />
          <div className="container position-relative" style={{ paddingTop: 'clamp(8rem, 18vh, 11rem)', paddingBottom: '9rem' }}>
            <div className="row">
              <div className="col-lg-6 fl-on-dark">
                <span className="fl-pill dark mb-4 fl-enter"><i className="bi bi-patch-check-fill text-lime" />Verified plots for youth farmers</span>
                <h1 className="fl-h-hero text-white mb-4 fl-enter d1">
                  Idle land. Young farmers. <span className="fl-serif text-lime">One fair harvest.</span>
                </h1>
                <p className="fl-lead text-white mb-4 fl-enter d2" style={{ maxWidth: 540, opacity: 0.85 }}>
                  FarmLink matches landowners who have unused farmland with young farmers who need it, then keeps
                  a shared record of the terms, the season and the harvest split.
                </p>
                <div className="d-flex flex-wrap gap-2 fl-enter d3">
                  <Link to="/register?role=landowner" className="btn btn-lime btn-lg btn-arrow">List your land <span className="fl-arrow"><i className="bi bi-arrow-up-right" /></span></Link>
                  <Link to="/register?role=farmer" className="btn btn-outline-light-fl btn-lg">Find a plot</Link>
                </div>
              </div>
            </div>
          </div>
          {/* Slide picker */}
          <div className="position-absolute bottom-0 start-0 p-4 ps-md-5 fl-dots fl-enter d5" role="group" aria-label="Hero photos">
            {slides.map((sl, n) => (
              <button key={sl.src} type="button" className={n === slide ? 'active' : ''} aria-label={`Show photo ${n + 1} of ${slides.length}`} aria-pressed={n === slide} onClick={() => goTo(n)}>
                <span />
              </button>
            ))}
          </div>
          {/* Floating cards follow the current slide */}
          <div className="position-absolute bottom-0 end-0 p-3 p-md-4 d-none d-md-flex gap-3 align-items-end" aria-hidden="true">
            <div className="fl-enter d4">
              <div className="fl-glass fl-bob" style={{ width: 230 }}>
                <div key={slide} className="fl-swap">
                  <div className="d-flex align-items-center gap-2 small mb-2"><span className="fl-status verified">Verified</span></div>
                  <div className="fw-semibold">{current.plot.size} · {current.plot.place}</div>
                  <div className="small" style={{ opacity: 0.8 }}>{current.plot.detail}</div>
                </div>
              </div>
            </div>
            <div className="fl-enter d5">
              <div className="fl-float fl-bob alt" style={{ width: 260 }}>
                <div key={slide} className="fl-swap">
                  <div className="small text-muted-fl mb-1">Harvest split · {heroSplit.total.toLocaleString('en-GH')} {current.split.unit} {current.split.crop}</div>
                  <div className="d-flex justify-content-between fw-semibold"><span>Landowner {heroSplit.landownerPercent}%</span><span>{heroSplit.landownerShare.toLocaleString('en-GH')}</span></div>
                  <div className="d-flex justify-content-between fw-semibold text-deep"><span>Farmer {heroSplit.farmerPercent}%</span><span>{heroSplit.farmerShare.toLocaleString('en-GH')}</span></div>
                </div>
                <div className="progress mt-2" style={{ height: 6 }}>
                  <div className="progress-bar" style={{ width: `${heroSplit.landownerPercent}%`, background: 'var(--fl-ochre)' }} />
                  <div className="progress-bar bg-primary" style={{ width: `${heroSplit.farmerPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Regions strip ---------- */}
      <section className="container py-5">
        <p className="text-center small text-muted-fl mb-4" data-reveal>Built for farming communities across Ghana</p>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          {regions.map((r, n) => <span className="fl-pill" key={r} data-reveal style={i(n)}><i className="bi bi-geo text-deep" />{r}</span>)}
        </div>
      </section>

      {/* ---------- Problem statement ---------- */}
      <section className="container pb-5" id="about">
        <span className="fl-eyebrow mb-3" data-reveal>Why FarmLink</span>
        <p className="fl-h-section fw-medium mb-0" data-reveal style={{ fontFamily: 'Outfit', maxWidth: 1050, color: 'var(--fl-ink)', ...i(1) }}>
          Many landowners hold unused plots, and many young people want to farm but cannot get land.{' '}
          <span className="text-muted-fl">Their arrangements are usually verbal, so terms get forgotten and harvests get disputed.</span>{' '}
          FarmLink puts the whole partnership <img src="/images/corn-field.jpg" alt="" className="d-inline-block align-middle rounded-pill object-fit-cover" style={{ width: '6rem', height: '2.6rem' }} /> on record.
        </p>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="fl-section fl-section-dark fl-on-dark fl-rounded-band">
        <div className="container">
          <div className="row g-4 align-items-end mb-5">
            <div className="col-lg-6" data-reveal>
              <span className="fl-eyebrow mb-3">How it works</span>
              <h2 className="fl-h-section mb-0">From idle plot to <span className="fl-serif text-lime">recorded harvest</span></h2>
            </div>
            <div className="col-lg-5 offset-lg-1" data-reveal style={i(1)}>
              <p className="mb-0">Four steps, each recorded and visible to both parties. If anything goes wrong, either side can raise a dispute and a verifier mediates using the record.</p>
            </div>
          </div>
          <div className="row g-4">
            <div className="col-lg-5" data-reveal="zoom">
              <div className="position-relative h-100 rounded-fl-xl overflow-hidden" style={{ minHeight: 420 }}>
                <img src="/images/farmers-weeding.jpg" alt="Farmers weeding a field together" className="position-absolute fl-cover" />
                <div className="position-absolute bottom-0 start-0 end-0 p-3">
                  <div className="fl-float">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="fw-semibold">Season tracker</span><span className="fl-status verified">On track</span>
                    </div>
                    {[['Cleared', true], ['Planted', true], ['Weeded', true], ['Harvested', false]].map(([m, done], n) => (
                      <div key={m} className="d-flex align-items-center gap-2 py-1 small fl-check" style={i(n)}>
                        <i className={`bi ${done ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted-fl'}`} /><span className={done ? '' : 'text-muted-fl'}>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-7 d-grid gap-3">
              {steps.map((s, n) => (
                <div key={s.title} data-reveal style={i(n)}>
                  <div className="fl-card-dark fl-lift d-flex gap-3">
                    <span className="fl-icon-tile"><i className={`bi ${s.icon}`} /></span>
                    <div>
                      <h3 className="h5 mb-1"><span className="text-lime me-2">0{n + 1}</span>{s.title}</h3>
                      <p className="mb-0 small">{s.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <FeatureShowcase />

      {/* ---------- Audiences ---------- */}
      <section className="fl-section pt-0 container">
        <div className="row g-4 align-items-end mb-5">
          <div className="col-lg-6" data-reveal>
            <span className="fl-eyebrow mb-3">Who it’s for</span>
            <h2 className="fl-h-section mb-0">One platform, both sides of the field</h2>
          </div>
          <div className="col-lg-5 offset-lg-1" data-reveal style={i(1)}><p className="fl-lead mb-0">Landowners keep their land productive. Young farmers get access to land and a clear deal. Verifiers keep everyone honest.</p></div>
        </div>
        <div className="row g-4">
          <div className="col-md-6 col-lg-4" id="landowners" data-reveal>
            <Link to="/register?role=landowner" className="fl-img-card">
              <img src="/images/corn-field.jpg" alt="A large green corn field" />
              <div className="fl-img-card-body">
                <span className="fl-pill lime mb-3">Landowners</span>
                <h3 className="h4">Put idle land to work</h3>
                <p className="small text-white-50 mb-0">List a plot, choose a farmer, agree your share and follow the season from anywhere.</p>
              </div>
            </Link>
          </div>
          <div className="col-md-6 col-lg-4" id="farmers" data-reveal style={i(1)}>
            <Link to="/register?role=farmer" className="fl-img-card">
              <img src="/images/farmer-basket.jpg" alt="A smiling farmer holding a basket of freshly harvested vegetables" />
              <div className="fl-img-card-body">
                <span className="fl-pill lime mb-3">Youth farmers & groups</span>
                <h3 className="h4">Find land you can farm</h3>
                <p className="small text-white-50 mb-0">Search verified plots near you, apply alone or as a group, and get your agreed share.</p>
              </div>
            </Link>
          </div>
          <div className="col-md-12 col-lg-4" data-reveal style={i(2)}>
            <div className="fl-img-card">
              <img src="/images/verifier-survey.jpg" alt="A woman with a clipboard checking a farm" />
              <div className="fl-img-card-body">
                <span className="fl-pill lime mb-3">Verifiers</span>
                <h3 className="h4">Check plots, settle disputes</h3>
                <p className="small text-white-50 mb-0">Extension officers and approved community verifiers confirm plots and mediate using the recorded agreement.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Calculator ---------- */}
      <section id="calculator" className="fl-section pt-0 container">
        <div className="row g-4 align-items-end mb-5">
          <div className="col-lg-6" data-reveal>
            <span className="fl-eyebrow mb-3">Harvest split</span>
            <h2 className="fl-h-section mb-0">Agree the split once. <span className="fl-serif text-deep">Never argue the maths.</span></h2>
          </div>
          <div className="col-lg-5 offset-lg-1" data-reveal style={i(1)}><p className="fl-lead mb-0">Try it. This is the same rule FarmLink uses when a farmer records the harvest.</p></div>
        </div>
        <div data-reveal style={i(2)}>
          <HarvestSplitDemo />
        </div>
      </section>

      {/* ---------- Evidence ---------- */}
      <section className="fl-section pt-0 container">
        <div className="row g-4">
          <div className="col-lg-5" data-reveal="zoom">
            <div className="rounded-fl-xl overflow-hidden h-100" style={{ minHeight: 360 }}>
              <img src="/images/maize-harvest.jpg" alt="A farmer drying harvested maize" className="fl-cover" />
            </div>
          </div>
          <div className="col-lg-7" data-reveal style={i(1)}>
            <div className="fl-card p-4 p-md-5">
              <span className="fl-eyebrow mb-3">The gap</span>
              <h2 className="h2 mb-4">Young farmers are farming with thin support</h2>
              <div className="row g-4">
                <div className="col-sm-6">
                  <CountUp className="fl-stat d-block" prefix="1 : " to={1500} />
                  <p className="small text-muted-fl mt-2 mb-0">Extension officers to farmers in Ghana, against an accepted standard of 1 : 500 (Ghanaian Times, 2025).</p>
                </div>
                <div className="col-sm-6">
                  <CountUp className="fl-stat d-block" to={3} suffix="×" duration={900} />
                  <p className="small text-muted-fl mt-2 mb-0">The recommended workload per officer, so verified, recorded arrangements matter more.</p>
                </div>
                <div className="col-sm-6">
                  <CountUp className="fl-stat d-block text-deep" to={4} duration={900} />
                  <p className="small text-muted-fl mt-2 mb-0">Season milestones recorded with photos: cleared, planted, weeded, harvested.</p>
                </div>
                <div className="col-sm-6">
                  <CountUp className="fl-stat d-block text-deep" to={2} duration={900} />
                  <p className="small text-muted-fl mt-2 mb-0">Confirmations on every agreement. Nothing is final until both parties confirm.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- More than land ---------- */}
      <section className="fl-section fl-section-dark fl-on-dark fl-rounded-band">
        <div className="container">
          <div className="row g-4 align-items-end mb-5">
            <div className="col-lg-6" data-reveal>
              <span className="fl-eyebrow mb-3">Beyond the plot</span>
              <h2 className="fl-h-section mb-0">Learn, connect <span className="fl-serif text-lime">and sell</span></h2>
            </div>
            <div className="col-lg-5 offset-lg-1" data-reveal style={i(1)}><p className="mb-0">Extended modules help new farmers grow beyond their first season.</p></div>
          </div>
          <div className="row g-4">
            {modules.map((m, n) => (
              <div className="col-md-6 col-lg-3" key={m.title} data-reveal style={i(n)}>
                <div className="fl-card-dark fl-lift fl-zoom p-0 overflow-hidden">
                  <div className="overflow-hidden"><img src={m.img} alt="" className="w-100 object-fit-cover" style={{ height: 190 }} loading="lazy" /></div>
                  <div className="p-4">
                    <span className="fl-icon-tile mb-3"><i className={`bi ${m.icon}`} /></span>
                    <h3 className="h5">{m.title}</h3>
                    <p className="small mb-0">{m.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="fl-section container">
        <div className="row g-4 g-lg-5">
          <div className="col-lg-4" data-reveal>
            <span className="fl-eyebrow mb-3">FAQ</span>
            <h2 className="fl-h-section">Clear about what FarmLink is, and isn’t</h2>
            <p className="fl-lead">Honest answers to the questions landowners and farmers ask first.</p>
          </div>
          <div className="col-lg-8">
            <div className="accordion fl-faq">
              {faqs.map((f, n) => (
                <details className="accordion-item bg-white" key={f.q} open={n === 0} data-reveal style={i(n)}>
                  <summary className="accordion-button collapsed">{f.q}</summary>
                  <div className="accordion-body pt-0 text-muted-fl">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="container" data-reveal="zoom">
        <div className="position-relative overflow-hidden rounded-fl-xl text-white p-4 p-md-5" style={{ isolation: 'isolate' }}>
          <img src="/images/crop-rows-sunset.jpg" alt="" className="position-absolute top-0 start-0 fl-cover" style={{ zIndex: -2 }} loading="lazy" />
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ zIndex: -1, background: 'linear-gradient(90deg, rgba(3,43,31,.92), rgba(3,43,31,.55))' }} />
          <div className="row align-items-center g-4 py-md-4">
            <div className="col-lg-7">
              <h2 className="fl-h-section text-white mb-3">Ready to put land and talent together?</h2>
              <p className="text-white-50 mb-0">Create a free account as a landowner, farmer or buyer. It takes about two minutes.</p>
            </div>
            <div className="col-lg-5 d-flex flex-wrap gap-2 justify-content-lg-end">
              <Link to="/register" className="btn btn-lime btn-lg btn-arrow">Get started <span className="fl-arrow"><i className="bi bi-arrow-up-right" /></span></Link>
              <Link to="/login" className="btn btn-outline-light-fl btn-lg">Log in</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
